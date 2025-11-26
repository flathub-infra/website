import functools
import hashlib
import inspect
import json
import time
from collections.abc import Callable
from enum import Enum
from typing import Annotated, Any, Literal, TypeVar, get_args, get_origin

import orjson
from fastapi import Response
from pydantic import BaseModel, TypeAdapter

from . import database

T = TypeVar("T")

STALE_THRESHOLD = 0.8


def _make_cache_key(func: Callable, args: tuple, kwargs: dict) -> str:
    sig = inspect.signature(func)
    bound = sig.bind_partial(*args, **kwargs)
    bound.apply_defaults()

    normalized_kwargs = {}
    for param_name, param_value in bound.arguments.items():
        if not isinstance(param_value, Response):
            normalized_kwargs[param_name] = param_value

    key_data = {
        "func": func.__name__,
        "kwargs": normalized_kwargs,
    }

    key_hash = hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()
    return f"cache:endpoint:{func.__name__}:{key_hash}"


def _make_refresh_lock_key(cache_key: str) -> str:
    return f"{cache_key}:refreshing"


def _serialize_value(value: Any) -> dict:
    if isinstance(value, BaseModel):
        serialized_value = value.model_dump(mode="json")
    else:
        serialized_value = value

    return {
        "value": serialized_value,
        "created_at": time.time(),
        "is_stale": False,
    }


def _deserialize_value(data: dict, expected_type: type) -> Any:
    if not isinstance(data, dict) or "value" not in data:
        return data

    value = data.get("value")

    if not expected_type:
        return value

    origin = get_origin(expected_type)
    if origin is Annotated:
        if isinstance(value, dict):
            args = get_args(expected_type)
            union_type = args[0]
            union_members = get_args(union_type)

            for member in union_members:
                if hasattr(member, "model_fields"):
                    for field_name, field_info in member.model_fields.items():
                        if field_name in value and isinstance(value[field_name], str):
                            field_type = field_info.annotation
                            origin_type = get_origin(field_type)
                            if origin_type is Literal:
                                literal_args = get_args(field_type)
                                for arg in literal_args:
                                    if (
                                        isinstance(arg, Enum)
                                        and arg.value == value[field_name]
                                    ):
                                        value[field_name] = arg
                                        break

            try:
                return TypeAdapter(expected_type).validate_python(value)
            except Exception:
                return value

    if inspect.isclass(expected_type):
        if issubclass(expected_type, BaseModel):
            return expected_type(**value) if isinstance(value, dict) else value

    return value


def _is_cache_stale(cache_data: dict, ttl: int) -> bool:
    if not isinstance(cache_data, dict):
        return True

    if cache_data.get("is_stale"):
        return True

    created_at = cache_data.get("created_at")
    if created_at:
        age = time.time() - created_at
        stale_threshold = ttl * STALE_THRESHOLD
        if age > stale_threshold:
            return True

    return False


def cached(ttl: int = 3600) -> Callable:
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            cache_key = _make_cache_key(func, args, kwargs)
            refresh_lock_key = _make_refresh_lock_key(cache_key)

            try:
                cached_data = database.redis_conn.get(cache_key)
                if cached_data:
                    cache_entry = orjson.loads(cached_data)

                    if not _is_cache_stale(cache_entry, ttl):
                        return _deserialize_value(
                            cache_entry,
                            func.__annotations__.get("return"),
                        )

                    if isinstance(cache_entry, dict) and "value" in cache_entry:
                        stale_value = _deserialize_value(
                            cache_entry,
                            func.__annotations__.get("return"),
                        )

                        try:
                            if database.redis_conn.setnx(refresh_lock_key, "1"):
                                database.redis_conn.expire(refresh_lock_key, 10)
                                try:
                                    fresh_result = func(*args, **kwargs)
                                    serialized = _serialize_value(fresh_result)
                                    database.redis_conn.setex(
                                        cache_key, ttl, orjson.dumps(serialized)
                                    )
                                    return fresh_result
                                finally:
                                    database.redis_conn.delete(refresh_lock_key)
                        except Exception as e:
                            print(f"Cache refresh error for {func.__name__}: {e}")

                        return stale_value

            except Exception as e:
                print(f"Cache get error for {func.__name__}: {e}")

            result = func(*args, **kwargs)

            try:
                serialized = _serialize_value(result)
                database.redis_conn.setex(cache_key, ttl, orjson.dumps(serialized))
            except Exception as e:
                print(f"Cache set error for {func.__name__}: {e}")

            return result

        return wrapper

    return decorator


def mark_stale_by_pattern(pattern: str) -> int:
    try:
        keys = database.redis_conn.keys(pattern)
        if not keys:
            return 0

        marked_count = 0
        for key in keys:
            try:
                cached_data = database.redis_conn.get(key)
                if cached_data:
                    cache_entry = orjson.loads(cached_data)

                    if isinstance(cache_entry, dict):
                        cache_entry["is_stale"] = True
                        database.redis_conn.set(key, orjson.dumps(cache_entry))
                        marked_count += 1
            except Exception as e:
                print(f"Error marking key {key} as stale: {e}")

        return marked_count
    except Exception as e:
        print(f"Cache mark stale error for pattern {pattern}: {e}")
        return 0


def invalidate_cache_by_pattern(pattern: str) -> int:
    try:
        keys = database.redis_conn.keys(pattern)
        if keys:
            return database.redis_conn.delete(*keys)
        return 0
    except Exception as e:
        print(f"Cache invalidation error for pattern {pattern}: {e}")
        return 0
