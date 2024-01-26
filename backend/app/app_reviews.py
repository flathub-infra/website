from dataclasses import dataclass
from datetime import timedelta

import logging
import requests
import orjson

from . import db

ODRS_BASE_URL = 'https://odrs.gnome.org/1.0/reviews/api'
REVIEWS_CACHE_KEY = 'odrs_reviews'

@dataclass
class AppReview: 
    average_rating: float
    
def _update_reviews():
    try:
        reviews = requests.get(f'{ODRS_BASE_URL}/ratings', timeout=15).json()
        db.redis_conn.set(REVIEWS_CACHE_KEY, orjson.dumps(reviews), ex=timedelta(days=1))
    except Exception as e:
        logging.exception(e)
        return None

    return reviews


def get_reviews(ids: list[str]) -> list[AppReview]:
    reviews = db.get_json_key(REVIEWS_CACHE_KEY)
    if not reviews: 
        reviews = _update_reviews()

        if not reviews:
            return []

    keys_weight  = {
        "star0": 0,
        "star1": 1,
        "star2": 2,
        "star3": 3,
        "star4": 4,
        "star5": 5,
    }
    
    result = []
    ids_left = ids.copy()
    for r, review in reviews.items():
        if not ids_left:
            break
        
        if r not in ids:
            continue
        
        weight = 0
        for k, w in keys_weight.items():
            weight += review[k] * w
        
        average_rating = round(weight / review['total'], 1)
        app_review = AppReview(average_rating=average_rating)
        result.append(app_review)
        
    return result