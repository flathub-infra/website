var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../../node_modules/lodash.merge/index.js
var require_lodash = __commonJS({
  "../../../node_modules/lodash.merge/index.js"(exports, module) {
    var LARGE_ARRAY_SIZE = 200;
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var HOT_COUNT = 800;
    var HOT_SPAN = 16;
    var MAX_SAFE_INTEGER = 9007199254740991;
    var argsTag = "[object Arguments]";
    var arrayTag = "[object Array]";
    var asyncTag = "[object AsyncFunction]";
    var boolTag = "[object Boolean]";
    var dateTag = "[object Date]";
    var errorTag = "[object Error]";
    var funcTag = "[object Function]";
    var genTag = "[object GeneratorFunction]";
    var mapTag = "[object Map]";
    var numberTag = "[object Number]";
    var nullTag = "[object Null]";
    var objectTag = "[object Object]";
    var proxyTag = "[object Proxy]";
    var regexpTag = "[object RegExp]";
    var setTag = "[object Set]";
    var stringTag = "[object String]";
    var undefinedTag = "[object Undefined]";
    var weakMapTag = "[object WeakMap]";
    var arrayBufferTag = "[object ArrayBuffer]";
    var dataViewTag = "[object DataView]";
    var float32Tag = "[object Float32Array]";
    var float64Tag = "[object Float64Array]";
    var int8Tag = "[object Int8Array]";
    var int16Tag = "[object Int16Array]";
    var int32Tag = "[object Int32Array]";
    var uint8Tag = "[object Uint8Array]";
    var uint8ClampedTag = "[object Uint8ClampedArray]";
    var uint16Tag = "[object Uint16Array]";
    var uint32Tag = "[object Uint32Array]";
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    var typedArrayTags = {};
    typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
    typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
    var freeGlobal = typeof globalThis == "object" && globalThis && globalThis.Object === Object && globalThis;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
    var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var freeProcess = moduleExports && freeGlobal.process;
    var nodeUtil = function() {
      try {
        var types = freeModule && freeModule.require && freeModule.require("util").types;
        if (types) {
          return types;
        }
        return freeProcess && freeProcess.binding && freeProcess.binding("util");
      } catch (e) {
      }
    }();
    var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
    function apply(func, thisArg, args) {
      switch (args.length) {
        case 0:
          return func.call(thisArg);
        case 1:
          return func.call(thisArg, args[0]);
        case 2:
          return func.call(thisArg, args[0], args[1]);
        case 3:
          return func.call(thisArg, args[0], args[1], args[2]);
      }
      return func.apply(thisArg, args);
    }
    function baseTimes(n, iteratee) {
      var index = -1, result = Array(n);
      while (++index < n) {
        result[index] = iteratee(index);
      }
      return result;
    }
    function baseUnary(func) {
      return function(value) {
        return func(value);
      };
    }
    function getValue(object, key) {
      return object == null ? void 0 : object[key];
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    var arrayProto = Array.prototype;
    var funcProto = Function.prototype;
    var objectProto = Object.prototype;
    var coreJsData = root["__core-js_shared__"];
    var funcToString = funcProto.toString;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var maskSrcKey = function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    }();
    var nativeObjectToString = objectProto.toString;
    var objectCtorString = funcToString.call(Object);
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    var Buffer2 = moduleExports ? root.Buffer : void 0;
    var Symbol2 = root.Symbol;
    var Uint8Array2 = root.Uint8Array;
    var allocUnsafe = Buffer2 ? Buffer2.allocUnsafe : void 0;
    var getPrototype = overArg(Object.getPrototypeOf, Object);
    var objectCreate = Object.create;
    var propertyIsEnumerable = objectProto.propertyIsEnumerable;
    var splice = arrayProto.splice;
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    var defineProperty = function() {
      try {
        var func = getNative(Object, "defineProperty");
        func({}, "", {});
        return func;
      } catch (e) {
      }
    }();
    var nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0;
    var nativeMax = Math.max;
    var nativeNow = Date.now;
    var Map = getNative(root, "Map");
    var nativeCreate = getNative(Object, "create");
    var baseCreate = function() {
      function object() {
      }
      return function(proto) {
        if (!isObject(proto)) {
          return {};
        }
        if (objectCreate) {
          return objectCreate(proto);
        }
        object.prototype = proto;
        var result = new object();
        object.prototype = void 0;
        return result;
      };
    }();
    function Hash(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty.call(data, key) ? data[key] : void 0;
    }
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
    }
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    function ListCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }
    function listCacheDelete(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      --this.size;
      return true;
    }
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    function listCacheSet(key, value) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        ++this.size;
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    function MapCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function mapCacheClear() {
      this.size = 0;
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map || ListCache)(),
        "string": new Hash()
      };
    }
    function mapCacheDelete(key) {
      var result = getMapData(this, key)["delete"](key);
      this.size -= result ? 1 : 0;
      return result;
    }
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    function mapCacheSet(key, value) {
      var data = getMapData(this, key), size = data.size;
      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    function Stack(entries) {
      var data = this.__data__ = new ListCache(entries);
      this.size = data.size;
    }
    function stackClear() {
      this.__data__ = new ListCache();
      this.size = 0;
    }
    function stackDelete(key) {
      var data = this.__data__, result = data["delete"](key);
      this.size = data.size;
      return result;
    }
    function stackGet(key) {
      return this.__data__.get(key);
    }
    function stackHas(key) {
      return this.__data__.has(key);
    }
    function stackSet(key, value) {
      var data = this.__data__;
      if (data instanceof ListCache) {
        var pairs = data.__data__;
        if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
          pairs.push([key, value]);
          this.size = ++data.size;
          return this;
        }
        data = this.__data__ = new MapCache(pairs);
      }
      data.set(key, value);
      this.size = data.size;
      return this;
    }
    Stack.prototype.clear = stackClear;
    Stack.prototype["delete"] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;
    function arrayLikeKeys(value, inherited) {
      var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
      for (var key in value) {
        if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
        (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
        isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
        isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
        isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    function assignMergeValue(object, key, value) {
      if (value !== void 0 && !eq(object[key], value) || value === void 0 && !(key in object)) {
        baseAssignValue(object, key, value);
      }
    }
    function assignValue(object, key, value) {
      var objValue = object[key];
      if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === void 0 && !(key in object)) {
        baseAssignValue(object, key, value);
      }
    }
    function assocIndexOf(array, key) {
      var length = array.length;
      while (length--) {
        if (eq(array[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    function baseAssignValue(object, key, value) {
      if (key == "__proto__" && defineProperty) {
        defineProperty(object, key, {
          "configurable": true,
          "enumerable": true,
          "value": value,
          "writable": true
        });
      } else {
        object[key] = value;
      }
    }
    var baseFor = createBaseFor();
    function baseGetTag(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    function baseIsArguments(value) {
      return isObjectLike(value) && baseGetTag(value) == argsTag;
    }
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    function baseIsTypedArray(value) {
      return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
    }
    function baseKeysIn(object) {
      if (!isObject(object)) {
        return nativeKeysIn(object);
      }
      var isProto = isPrototype(object), result = [];
      for (var key in object) {
        if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) {
          result.push(key);
        }
      }
      return result;
    }
    function baseMerge(object, source, srcIndex, customizer, stack) {
      if (object === source) {
        return;
      }
      baseFor(source, function(srcValue, key) {
        stack || (stack = new Stack());
        if (isObject(srcValue)) {
          baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
        } else {
          var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : void 0;
          if (newValue === void 0) {
            newValue = srcValue;
          }
          assignMergeValue(object, key, newValue);
        }
      }, keysIn);
    }
    function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
      var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
      if (stacked) {
        assignMergeValue(object, key, stacked);
        return;
      }
      var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : void 0;
      var isCommon = newValue === void 0;
      if (isCommon) {
        var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
        newValue = srcValue;
        if (isArr || isBuff || isTyped) {
          if (isArray(objValue)) {
            newValue = objValue;
          } else if (isArrayLikeObject(objValue)) {
            newValue = copyArray(objValue);
          } else if (isBuff) {
            isCommon = false;
            newValue = cloneBuffer(srcValue, true);
          } else if (isTyped) {
            isCommon = false;
            newValue = cloneTypedArray(srcValue, true);
          } else {
            newValue = [];
          }
        } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
          newValue = objValue;
          if (isArguments(objValue)) {
            newValue = toPlainObject(objValue);
          } else if (!isObject(objValue) || isFunction(objValue)) {
            newValue = initCloneObject(srcValue);
          }
        } else {
          isCommon = false;
        }
      }
      if (isCommon) {
        stack.set(srcValue, newValue);
        mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
        stack["delete"](srcValue);
      }
      assignMergeValue(object, key, newValue);
    }
    function baseRest(func, start) {
      return setToString(overRest(func, start, identity), func + "");
    }
    var baseSetToString = !defineProperty ? identity : function(func, string) {
      return defineProperty(func, "toString", {
        "configurable": true,
        "enumerable": false,
        "value": constant(string),
        "writable": true
      });
    };
    function cloneBuffer(buffer, isDeep) {
      if (isDeep) {
        return buffer.slice();
      }
      var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
      buffer.copy(result);
      return result;
    }
    function cloneArrayBuffer(arrayBuffer) {
      var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
      new Uint8Array2(result).set(new Uint8Array2(arrayBuffer));
      return result;
    }
    function cloneTypedArray(typedArray, isDeep) {
      var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
      return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
    }
    function copyArray(source, array) {
      var index = -1, length = source.length;
      array || (array = Array(length));
      while (++index < length) {
        array[index] = source[index];
      }
      return array;
    }
    function copyObject(source, props, object, customizer) {
      var isNew = !object;
      object || (object = {});
      var index = -1, length = props.length;
      while (++index < length) {
        var key = props[index];
        var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
        if (newValue === void 0) {
          newValue = source[key];
        }
        if (isNew) {
          baseAssignValue(object, key, newValue);
        } else {
          assignValue(object, key, newValue);
        }
      }
      return object;
    }
    function createAssigner(assigner) {
      return baseRest(function(object, sources) {
        var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : void 0, guard = length > 2 ? sources[2] : void 0;
        customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : void 0;
        if (guard && isIterateeCall(sources[0], sources[1], guard)) {
          customizer = length < 3 ? void 0 : customizer;
          length = 1;
        }
        object = Object(object);
        while (++index < length) {
          var source = sources[index];
          if (source) {
            assigner(object, source, index, customizer);
          }
        }
        return object;
      });
    }
    function createBaseFor(fromRight) {
      return function(object, iteratee, keysFunc) {
        var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
        while (length--) {
          var key = props[fromRight ? length : ++index];
          if (iteratee(iterable[key], key, iterable) === false) {
            break;
          }
        }
        return object;
      };
    }
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : void 0;
    }
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    function initCloneObject(object) {
      return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
    }
    function isIndex(value, length) {
      var type = typeof value;
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    function isIterateeCall(value, index, object) {
      if (!isObject(object)) {
        return false;
      }
      var type = typeof index;
      if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
        return eq(object[index], value);
      }
      return false;
    }
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    function nativeKeysIn(object) {
      var result = [];
      if (object != null) {
        for (var key in Object(object)) {
          result.push(key);
        }
      }
      return result;
    }
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    function overRest(func, start, transform) {
      start = nativeMax(start === void 0 ? func.length - 1 : start, 0);
      return function() {
        var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
        while (++index < length) {
          array[index] = args[start + index];
        }
        index = -1;
        var otherArgs = Array(start + 1);
        while (++index < start) {
          otherArgs[index] = args[index];
        }
        otherArgs[start] = transform(array);
        return apply(func, this, otherArgs);
      };
    }
    function safeGet(object, key) {
      if (key === "constructor" && typeof object[key] === "function") {
        return;
      }
      if (key == "__proto__") {
        return;
      }
      return object[key];
    }
    var setToString = shortOut(baseSetToString);
    function shortOut(func) {
      var count = 0, lastCalled = 0;
      return function() {
        var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
        lastCalled = stamp;
        if (remaining > 0) {
          if (++count >= HOT_COUNT) {
            return arguments[0];
          }
        } else {
          count = 0;
        }
        return func.apply(void 0, arguments);
      };
    }
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    var isArguments = baseIsArguments(function() {
      return arguments;
    }()) ? baseIsArguments : function(value) {
      return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
    };
    var isArray = Array.isArray;
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    function isArrayLikeObject(value) {
      return isObjectLike(value) && isArrayLike(value);
    }
    var isBuffer = nativeIsBuffer || stubFalse;
    function isFunction(value) {
      if (!isObject(value)) {
        return false;
      }
      var tag = baseGetTag(value);
      return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
    }
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    function isPlainObject(value) {
      if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
        return false;
      }
      var proto = getPrototype(value);
      if (proto === null) {
        return true;
      }
      var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
      return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
    }
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
    function toPlainObject(value) {
      return copyObject(value, keysIn(value));
    }
    function keysIn(object) {
      return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
    }
    var merge2 = createAssigner(function(object, source, srcIndex) {
      baseMerge(object, source, srcIndex);
    });
    function constant(value) {
      return function() {
        return value;
      };
    }
    function identity(value) {
      return value;
    }
    function stubFalse() {
      return false;
    }
    module.exports = merge2;
  }
});

// ../../../node_modules/parsimmon/src/parsimmon.js
var require_parsimmon = __commonJS({
  "../../../node_modules/parsimmon/src/parsimmon.js"(exports, module) {
    "use strict";
    function Parsimmon2(action) {
      if (!(this instanceof Parsimmon2)) {
        return new Parsimmon2(action);
      }
      this._ = action;
    }
    var _ = Parsimmon2.prototype;
    function times(n, f) {
      var i = 0;
      for (i; i < n; i++) {
        f(i);
      }
    }
    function forEach(f, arr) {
      times(arr.length, function(i) {
        f(arr[i], i, arr);
      });
    }
    function reduce(f, seed, arr) {
      forEach(function(elem, i, arr2) {
        seed = f(seed, elem, i, arr2);
      }, arr);
      return seed;
    }
    function map(f, arr) {
      return reduce(
        function(acc, elem, i, a) {
          return acc.concat([f(elem, i, a)]);
        },
        [],
        arr
      );
    }
    function lshiftBuffer(input) {
      var asTwoBytes = reduce(
        function(a, v, i, b) {
          return a.concat(
            i === b.length - 1 ? Buffer.from([v, 0]).readUInt16BE(0) : b.readUInt16BE(i)
          );
        },
        [],
        input
      );
      return Buffer.from(
        map(function(x) {
          return (x << 1 & 65535) >> 8;
        }, asTwoBytes)
      );
    }
    function consumeBitsFromBuffer(n, input) {
      var state = { v: 0, buf: input };
      times(n, function() {
        state = {
          v: state.v << 1 | bitPeekBuffer(state.buf),
          buf: lshiftBuffer(state.buf)
        };
      });
      return state;
    }
    function bitPeekBuffer(input) {
      return input[0] >> 7;
    }
    function sum(numArr) {
      return reduce(
        function(x, y) {
          return x + y;
        },
        0,
        numArr
      );
    }
    function find(pred, arr) {
      return reduce(
        function(found, elem) {
          return found || (pred(elem) ? elem : found);
        },
        null,
        arr
      );
    }
    function bufferExists() {
      return typeof Buffer !== "undefined";
    }
    function setExists() {
      if (Parsimmon2._supportsSet !== void 0) {
        return Parsimmon2._supportsSet;
      }
      var exists = typeof Set !== "undefined";
      Parsimmon2._supportsSet = exists;
      return exists;
    }
    function ensureBuffer() {
      if (!bufferExists()) {
        throw new Error(
          "Buffer global does not exist; please use webpack if you need to parse Buffers in the browser."
        );
      }
    }
    function bitSeq(alignments) {
      ensureBuffer();
      var totalBits = sum(alignments);
      if (totalBits % 8 !== 0) {
        throw new Error(
          "The bits [" + alignments.join(", ") + "] add up to " + totalBits + " which is not an even number of bytes; the total should be divisible by 8"
        );
      }
      var bytes = totalBits / 8;
      var tooBigRange = find(function(x) {
        return x > 48;
      }, alignments);
      if (tooBigRange) {
        throw new Error(
          tooBigRange + " bit range requested exceeds 48 bit (6 byte) Number max."
        );
      }
      return new Parsimmon2(function(input, i) {
        var newPos = bytes + i;
        if (newPos > input.length) {
          return makeFailure(i, bytes.toString() + " bytes");
        }
        return makeSuccess(
          newPos,
          reduce(
            function(acc, bits) {
              var state = consumeBitsFromBuffer(bits, acc.buf);
              return {
                coll: acc.coll.concat(state.v),
                buf: state.buf
              };
            },
            { coll: [], buf: input.slice(i, newPos) },
            alignments
          ).coll
        );
      });
    }
    function bitSeqObj(namedAlignments) {
      ensureBuffer();
      var seenKeys = {};
      var totalKeys = 0;
      var fullAlignments = map(function(item) {
        if (isArray(item)) {
          var pair = item;
          if (pair.length !== 2) {
            throw new Error(
              "[" + pair.join(", ") + "] should be length 2, got length " + pair.length
            );
          }
          assertString(pair[0]);
          assertNumber(pair[1]);
          if (Object.prototype.hasOwnProperty.call(seenKeys, pair[0])) {
            throw new Error("duplicate key in bitSeqObj: " + pair[0]);
          }
          seenKeys[pair[0]] = true;
          totalKeys++;
          return pair;
        } else {
          assertNumber(item);
          return [null, item];
        }
      }, namedAlignments);
      if (totalKeys < 1) {
        throw new Error(
          "bitSeqObj expects at least one named pair, got [" + namedAlignments.join(", ") + "]"
        );
      }
      var namesOnly = map(function(pair) {
        return pair[0];
      }, fullAlignments);
      var alignmentsOnly = map(function(pair) {
        return pair[1];
      }, fullAlignments);
      return bitSeq(alignmentsOnly).map(function(parsed) {
        var namedParsed = map(function(name, i) {
          return [name, parsed[i]];
        }, namesOnly);
        return reduce(
          function(obj, kv) {
            if (kv[0] !== null) {
              obj[kv[0]] = kv[1];
            }
            return obj;
          },
          {},
          namedParsed
        );
      });
    }
    function parseBufferFor(other, length) {
      return new Parsimmon2(function(input, i) {
        ensureBuffer();
        if (i + length > input.length) {
          return makeFailure(i, length + " bytes for " + other);
        }
        return makeSuccess(i + length, input.slice(i, i + length));
      });
    }
    function parseBuffer(length) {
      return parseBufferFor("buffer", length).map(function(unsafe) {
        return Buffer.from(unsafe);
      });
    }
    function encodedString(encoding, length) {
      return parseBufferFor("string", length).map(function(buff) {
        return buff.toString(encoding);
      });
    }
    function isInteger(value) {
      return typeof value === "number" && Math.floor(value) === value;
    }
    function assertValidIntegerByteLengthFor(who, length) {
      if (!isInteger(length) || length < 0 || length > 6) {
        throw new Error(who + " requires integer length in range [0, 6].");
      }
    }
    function uintBE(length) {
      assertValidIntegerByteLengthFor("uintBE", length);
      return parseBufferFor("uintBE(" + length + ")", length).map(function(buff) {
        return buff.readUIntBE(0, length);
      });
    }
    function uintLE(length) {
      assertValidIntegerByteLengthFor("uintLE", length);
      return parseBufferFor("uintLE(" + length + ")", length).map(function(buff) {
        return buff.readUIntLE(0, length);
      });
    }
    function intBE(length) {
      assertValidIntegerByteLengthFor("intBE", length);
      return parseBufferFor("intBE(" + length + ")", length).map(function(buff) {
        return buff.readIntBE(0, length);
      });
    }
    function intLE(length) {
      assertValidIntegerByteLengthFor("intLE", length);
      return parseBufferFor("intLE(" + length + ")", length).map(function(buff) {
        return buff.readIntLE(0, length);
      });
    }
    function floatBE() {
      return parseBufferFor("floatBE", 4).map(function(buff) {
        return buff.readFloatBE(0);
      });
    }
    function floatLE() {
      return parseBufferFor("floatLE", 4).map(function(buff) {
        return buff.readFloatLE(0);
      });
    }
    function doubleBE() {
      return parseBufferFor("doubleBE", 8).map(function(buff) {
        return buff.readDoubleBE(0);
      });
    }
    function doubleLE() {
      return parseBufferFor("doubleLE", 8).map(function(buff) {
        return buff.readDoubleLE(0);
      });
    }
    function toArray(arrLike) {
      return Array.prototype.slice.call(arrLike);
    }
    function isParser(obj) {
      return obj instanceof Parsimmon2;
    }
    function isArray(x) {
      return {}.toString.call(x) === "[object Array]";
    }
    function isBuffer(x) {
      return bufferExists() && Buffer.isBuffer(x);
    }
    function makeSuccess(index2, value) {
      return {
        status: true,
        index: index2,
        value,
        furthest: -1,
        expected: []
      };
    }
    function makeFailure(index2, expected) {
      if (!isArray(expected)) {
        expected = [expected];
      }
      return {
        status: false,
        index: -1,
        value: null,
        furthest: index2,
        expected
      };
    }
    function mergeReplies(result, last) {
      if (!last) {
        return result;
      }
      if (result.furthest > last.furthest) {
        return result;
      }
      var expected = result.furthest === last.furthest ? union(result.expected, last.expected) : last.expected;
      return {
        status: result.status,
        index: result.index,
        value: result.value,
        furthest: last.furthest,
        expected
      };
    }
    var lineColumnIndex = {};
    function makeLineColumnIndex(input, i) {
      if (isBuffer(input)) {
        return {
          offset: i,
          line: -1,
          column: -1
        };
      }
      if (!(input in lineColumnIndex)) {
        lineColumnIndex[input] = {};
      }
      var inputIndex = lineColumnIndex[input];
      var prevLine = 0;
      var newLines = 0;
      var lineStart = 0;
      var j = i;
      while (j >= 0) {
        if (j in inputIndex) {
          prevLine = inputIndex[j].line;
          if (lineStart === 0) {
            lineStart = inputIndex[j].lineStart;
          }
          break;
        }
        if (
          // Unix LF (\n) or Windows CRLF (\r\n) line ending
          input.charAt(j) === "\n" || // Old Mac CR (\r) line ending
          input.charAt(j) === "\r" && input.charAt(j + 1) !== "\n"
        ) {
          newLines++;
          if (lineStart === 0) {
            lineStart = j + 1;
          }
        }
        j--;
      }
      var lineWeAreUpTo = prevLine + newLines;
      var columnWeAreUpTo = i - lineStart;
      inputIndex[i] = { line: lineWeAreUpTo, lineStart };
      return {
        offset: i,
        line: lineWeAreUpTo + 1,
        column: columnWeAreUpTo + 1
      };
    }
    function union(xs, ys) {
      if (setExists() && Array.from) {
        var set = new Set(xs);
        for (var y = 0; y < ys.length; y++) {
          set.add(ys[y]);
        }
        var arr = Array.from(set);
        arr.sort();
        return arr;
      }
      var obj = {};
      for (var i = 0; i < xs.length; i++) {
        obj[xs[i]] = true;
      }
      for (var j = 0; j < ys.length; j++) {
        obj[ys[j]] = true;
      }
      var keys = [];
      for (var k in obj) {
        if ({}.hasOwnProperty.call(obj, k)) {
          keys.push(k);
        }
      }
      keys.sort();
      return keys;
    }
    function assertParser(p) {
      if (!isParser(p)) {
        throw new Error("not a parser: " + p);
      }
    }
    function get(input, i) {
      if (typeof input === "string") {
        return input.charAt(i);
      }
      return input[i];
    }
    function assertArray(x) {
      if (!isArray(x)) {
        throw new Error("not an array: " + x);
      }
    }
    function assertNumber(x) {
      if (typeof x !== "number") {
        throw new Error("not a number: " + x);
      }
    }
    function assertRegexp(x) {
      if (!(x instanceof RegExp)) {
        throw new Error("not a regexp: " + x);
      }
      var f = flags(x);
      for (var i = 0; i < f.length; i++) {
        var c = f.charAt(i);
        if (c !== "i" && c !== "m" && c !== "u" && c !== "s") {
          throw new Error('unsupported regexp flag "' + c + '": ' + x);
        }
      }
    }
    function assertFunction(x) {
      if (typeof x !== "function") {
        throw new Error("not a function: " + x);
      }
    }
    function assertString(x) {
      if (typeof x !== "string") {
        throw new Error("not a string: " + x);
      }
    }
    var linesBeforeStringError = 2;
    var linesAfterStringError = 3;
    var bytesPerLine = 8;
    var bytesBefore = bytesPerLine * 5;
    var bytesAfter = bytesPerLine * 4;
    var defaultLinePrefix = "  ";
    function repeat(string2, amount) {
      return new Array(amount + 1).join(string2);
    }
    function formatExpected(expected) {
      if (expected.length === 1) {
        return "Expected:\n\n" + expected[0];
      }
      return "Expected one of the following: \n\n" + expected.join(", ");
    }
    function leftPad(str, pad, char) {
      var add = pad - str.length;
      if (add <= 0) {
        return str;
      }
      return repeat(char, add) + str;
    }
    function toChunks(arr, chunkSize) {
      var length = arr.length;
      var chunks = [];
      var chunkIndex = 0;
      if (length <= chunkSize) {
        return [arr.slice()];
      }
      for (var i = 0; i < length; i++) {
        if (!chunks[chunkIndex]) {
          chunks.push([]);
        }
        chunks[chunkIndex].push(arr[i]);
        if ((i + 1) % chunkSize === 0) {
          chunkIndex++;
        }
      }
      return chunks;
    }
    function rangeFromIndexAndOffsets(i, before, after, length) {
      return {
        // Guard against the negative upper bound for lines included in the output.
        from: i - before > 0 ? i - before : 0,
        to: i + after > length ? length : i + after
      };
    }
    function byteRangeToRange(byteRange) {
      if (byteRange.from === 0 && byteRange.to === 1) {
        return {
          from: byteRange.from,
          to: byteRange.to
        };
      }
      return {
        from: byteRange.from / bytesPerLine,
        // Round `to`, so we don't get float if the amount of bytes is not divisible by `bytesPerLine`
        to: Math.floor(byteRange.to / bytesPerLine)
      };
    }
    function formatGot(input, error) {
      var index2 = error.index;
      var i = index2.offset;
      var verticalMarkerLength = 1;
      var column;
      var lineWithErrorIndex;
      var lines;
      var lineRange;
      var lastLineNumberLabelLength;
      if (i === input.length) {
        return "Got the end of the input";
      }
      if (isBuffer(input)) {
        var byteLineWithErrorIndex = i - i % bytesPerLine;
        var columnByteIndex = i - byteLineWithErrorIndex;
        var byteRange = rangeFromIndexAndOffsets(
          byteLineWithErrorIndex,
          bytesBefore,
          bytesAfter + bytesPerLine,
          input.length
        );
        var bytes = input.slice(byteRange.from, byteRange.to);
        var bytesInChunks = toChunks(bytes.toJSON().data, bytesPerLine);
        var byteLines = map(function(byteRow) {
          return map(function(byteValue) {
            return leftPad(byteValue.toString(16), 2, "0");
          }, byteRow);
        }, bytesInChunks);
        lineRange = byteRangeToRange(byteRange);
        lineWithErrorIndex = byteLineWithErrorIndex / bytesPerLine;
        column = columnByteIndex * 3;
        if (columnByteIndex >= 4) {
          column += 1;
        }
        verticalMarkerLength = 2;
        lines = map(function(byteLine) {
          return byteLine.length <= 4 ? byteLine.join(" ") : byteLine.slice(0, 4).join(" ") + "  " + byteLine.slice(4).join(" ");
        }, byteLines);
        lastLineNumberLabelLength = ((lineRange.to > 0 ? lineRange.to - 1 : lineRange.to) * 8).toString(16).length;
        if (lastLineNumberLabelLength < 2) {
          lastLineNumberLabelLength = 2;
        }
      } else {
        var inputLines = input.split(/\r\n|[\n\r\u2028\u2029]/);
        column = index2.column - 1;
        lineWithErrorIndex = index2.line - 1;
        lineRange = rangeFromIndexAndOffsets(
          lineWithErrorIndex,
          linesBeforeStringError,
          linesAfterStringError,
          inputLines.length
        );
        lines = inputLines.slice(lineRange.from, lineRange.to);
        lastLineNumberLabelLength = lineRange.to.toString().length;
      }
      var lineWithErrorCurrentIndex = lineWithErrorIndex - lineRange.from;
      if (isBuffer(input)) {
        lastLineNumberLabelLength = ((lineRange.to > 0 ? lineRange.to - 1 : lineRange.to) * 8).toString(16).length;
        if (lastLineNumberLabelLength < 2) {
          lastLineNumberLabelLength = 2;
        }
      }
      var linesWithLineNumbers = reduce(
        function(acc, lineSource, index3) {
          var isLineWithError = index3 === lineWithErrorCurrentIndex;
          var prefix = isLineWithError ? "> " : defaultLinePrefix;
          var lineNumberLabel;
          if (isBuffer(input)) {
            lineNumberLabel = leftPad(
              ((lineRange.from + index3) * 8).toString(16),
              lastLineNumberLabelLength,
              "0"
            );
          } else {
            lineNumberLabel = leftPad(
              (lineRange.from + index3 + 1).toString(),
              lastLineNumberLabelLength,
              " "
            );
          }
          return [].concat(
            acc,
            [prefix + lineNumberLabel + " | " + lineSource],
            isLineWithError ? [
              defaultLinePrefix + repeat(" ", lastLineNumberLabelLength) + " | " + leftPad("", column, " ") + repeat("^", verticalMarkerLength)
            ] : []
          );
        },
        [],
        lines
      );
      return linesWithLineNumbers.join("\n");
    }
    function formatError(input, error) {
      return [
        "\n",
        "-- PARSING FAILED " + repeat("-", 50),
        "\n\n",
        formatGot(input, error),
        "\n\n",
        formatExpected(error.expected),
        "\n"
      ].join("");
    }
    function flags(re) {
      if (re.flags !== void 0) {
        return re.flags;
      }
      return [
        re.global ? "g" : "",
        re.ignoreCase ? "i" : "",
        re.multiline ? "m" : "",
        re.unicode ? "u" : "",
        re.sticky ? "y" : ""
      ].join("");
    }
    function anchoredRegexp(re) {
      return RegExp("^(?:" + re.source + ")", flags(re));
    }
    function seq() {
      var parsers = [].slice.call(arguments);
      var numParsers = parsers.length;
      for (var j = 0; j < numParsers; j += 1) {
        assertParser(parsers[j]);
      }
      return Parsimmon2(function(input, i) {
        var result;
        var accum = new Array(numParsers);
        for (var j2 = 0; j2 < numParsers; j2 += 1) {
          result = mergeReplies(parsers[j2]._(input, i), result);
          if (!result.status) {
            return result;
          }
          accum[j2] = result.value;
          i = result.index;
        }
        return mergeReplies(makeSuccess(i, accum), result);
      });
    }
    function seqObj() {
      var seenKeys = {};
      var totalKeys = 0;
      var parsers = toArray(arguments);
      var numParsers = parsers.length;
      for (var j = 0; j < numParsers; j += 1) {
        var p = parsers[j];
        if (isParser(p)) {
          continue;
        }
        if (isArray(p)) {
          var isWellFormed = p.length === 2 && typeof p[0] === "string" && isParser(p[1]);
          if (isWellFormed) {
            var key = p[0];
            if (Object.prototype.hasOwnProperty.call(seenKeys, key)) {
              throw new Error("seqObj: duplicate key " + key);
            }
            seenKeys[key] = true;
            totalKeys++;
            continue;
          }
        }
        throw new Error(
          "seqObj arguments must be parsers or [string, parser] array pairs."
        );
      }
      if (totalKeys === 0) {
        throw new Error("seqObj expects at least one named parser, found zero");
      }
      return Parsimmon2(function(input, i) {
        var result;
        var accum = {};
        for (var j2 = 0; j2 < numParsers; j2 += 1) {
          var name;
          var parser2;
          if (isArray(parsers[j2])) {
            name = parsers[j2][0];
            parser2 = parsers[j2][1];
          } else {
            name = null;
            parser2 = parsers[j2];
          }
          result = mergeReplies(parser2._(input, i), result);
          if (!result.status) {
            return result;
          }
          if (name) {
            accum[name] = result.value;
          }
          i = result.index;
        }
        return mergeReplies(makeSuccess(i, accum), result);
      });
    }
    function seqMap() {
      var args = [].slice.call(arguments);
      if (args.length === 0) {
        throw new Error("seqMap needs at least one argument");
      }
      var mapper = args.pop();
      assertFunction(mapper);
      return seq.apply(null, args).map(function(results) {
        return mapper.apply(null, results);
      });
    }
    function createLanguage(parsers) {
      var language = {};
      for (var key in parsers) {
        if ({}.hasOwnProperty.call(parsers, key)) {
          (function(key2) {
            var func = function() {
              return parsers[key2](language);
            };
            language[key2] = lazy(func);
          })(key);
        }
      }
      return language;
    }
    function alt() {
      var parsers = [].slice.call(arguments);
      var numParsers = parsers.length;
      if (numParsers === 0) {
        return fail("zero alternates");
      }
      for (var j = 0; j < numParsers; j += 1) {
        assertParser(parsers[j]);
      }
      return Parsimmon2(function(input, i) {
        var result;
        for (var j2 = 0; j2 < parsers.length; j2 += 1) {
          result = mergeReplies(parsers[j2]._(input, i), result);
          if (result.status) {
            return result;
          }
        }
        return result;
      });
    }
    function sepBy(parser2, separator) {
      return sepBy1(parser2, separator).or(succeed([]));
    }
    function sepBy1(parser2, separator) {
      assertParser(parser2);
      assertParser(separator);
      var pairs = separator.then(parser2).many();
      return seqMap(parser2, pairs, function(r, rs) {
        return [r].concat(rs);
      });
    }
    _.parse = function(input) {
      if (typeof input !== "string" && !isBuffer(input)) {
        throw new Error(
          ".parse must be called with a string or Buffer as its argument"
        );
      }
      var parseResult = this.skip(eof)._(input, 0);
      var result;
      if (parseResult.status) {
        result = {
          status: true,
          value: parseResult.value
        };
      } else {
        result = {
          status: false,
          index: makeLineColumnIndex(input, parseResult.furthest),
          expected: parseResult.expected
        };
      }
      delete lineColumnIndex[input];
      return result;
    };
    _.tryParse = function(str) {
      var result = this.parse(str);
      if (result.status) {
        return result.value;
      } else {
        var msg = formatError(str, result);
        var err = new Error(msg);
        err.type = "ParsimmonError";
        err.result = result;
        throw err;
      }
    };
    _.assert = function(condition, errorMessage) {
      return this.chain(function(value) {
        return condition(value) ? succeed(value) : fail(errorMessage);
      });
    };
    _.or = function(alternative) {
      return alt(this, alternative);
    };
    _.trim = function(parser2) {
      return this.wrap(parser2, parser2);
    };
    _.wrap = function(leftParser, rightParser) {
      return seqMap(leftParser, this, rightParser, function(left, middle) {
        return middle;
      });
    };
    _.thru = function(wrapper) {
      return wrapper(this);
    };
    _.then = function(next) {
      assertParser(next);
      return seq(this, next).map(function(results) {
        return results[1];
      });
    };
    _.many = function() {
      var self2 = this;
      return Parsimmon2(function(input, i) {
        var accum = [];
        var result = void 0;
        for (; ; ) {
          result = mergeReplies(self2._(input, i), result);
          if (result.status) {
            if (i === result.index) {
              throw new Error(
                "infinite loop detected in .many() parser --- calling .many() on a parser which can accept zero characters is usually the cause"
              );
            }
            i = result.index;
            accum.push(result.value);
          } else {
            return mergeReplies(makeSuccess(i, accum), result);
          }
        }
      });
    };
    _.tieWith = function(separator) {
      assertString(separator);
      return this.map(function(args) {
        assertArray(args);
        if (args.length) {
          assertString(args[0]);
          var s = args[0];
          for (var i = 1; i < args.length; i++) {
            assertString(args[i]);
            s += separator + args[i];
          }
          return s;
        } else {
          return "";
        }
      });
    };
    _.tie = function() {
      return this.tieWith("");
    };
    _.times = function(min, max) {
      var self2 = this;
      if (arguments.length < 2) {
        max = min;
      }
      assertNumber(min);
      assertNumber(max);
      return Parsimmon2(function(input, i) {
        var accum = [];
        var result = void 0;
        var prevResult = void 0;
        for (var times2 = 0; times2 < min; times2 += 1) {
          result = self2._(input, i);
          prevResult = mergeReplies(result, prevResult);
          if (result.status) {
            i = result.index;
            accum.push(result.value);
          } else {
            return prevResult;
          }
        }
        for (; times2 < max; times2 += 1) {
          result = self2._(input, i);
          prevResult = mergeReplies(result, prevResult);
          if (result.status) {
            i = result.index;
            accum.push(result.value);
          } else {
            break;
          }
        }
        return mergeReplies(makeSuccess(i, accum), prevResult);
      });
    };
    _.result = function(res) {
      return this.map(function() {
        return res;
      });
    };
    _.atMost = function(n) {
      return this.times(0, n);
    };
    _.atLeast = function(n) {
      return seqMap(this.times(n), this.many(), function(init, rest) {
        return init.concat(rest);
      });
    };
    _.map = function(fn) {
      assertFunction(fn);
      var self2 = this;
      return Parsimmon2(function(input, i) {
        var result = self2._(input, i);
        if (!result.status) {
          return result;
        }
        return mergeReplies(makeSuccess(result.index, fn(result.value)), result);
      });
    };
    _.contramap = function(fn) {
      assertFunction(fn);
      var self2 = this;
      return Parsimmon2(function(input, i) {
        var result = self2.parse(fn(input.slice(i)));
        if (!result.status) {
          return result;
        }
        return makeSuccess(i + input.length, result.value);
      });
    };
    _.promap = function(f, g) {
      assertFunction(f);
      assertFunction(g);
      return this.contramap(f).map(g);
    };
    _.skip = function(next) {
      return seq(this, next).map(function(results) {
        return results[0];
      });
    };
    _.mark = function() {
      return seqMap(index, this, index, function(start, value, end2) {
        return {
          start,
          value,
          end: end2
        };
      });
    };
    _.node = function(name) {
      return seqMap(index, this, index, function(start, value, end2) {
        return {
          name,
          value,
          start,
          end: end2
        };
      });
    };
    _.sepBy = function(separator) {
      return sepBy(this, separator);
    };
    _.sepBy1 = function(separator) {
      return sepBy1(this, separator);
    };
    _.lookahead = function(x) {
      return this.skip(lookahead(x));
    };
    _.notFollowedBy = function(x) {
      return this.skip(notFollowedBy(x));
    };
    _.desc = function(expected) {
      if (!isArray(expected)) {
        expected = [expected];
      }
      var self2 = this;
      return Parsimmon2(function(input, i) {
        var reply = self2._(input, i);
        if (!reply.status) {
          reply.expected = expected;
        }
        return reply;
      });
    };
    _.fallback = function(result) {
      return this.or(succeed(result));
    };
    _.ap = function(other) {
      return seqMap(other, this, function(f, x) {
        return f(x);
      });
    };
    _.chain = function(f) {
      var self2 = this;
      return Parsimmon2(function(input, i) {
        var result = self2._(input, i);
        if (!result.status) {
          return result;
        }
        var nextParser = f(result.value);
        return mergeReplies(nextParser._(input, result.index), result);
      });
    };
    function string(str) {
      assertString(str);
      var expected = "'" + str + "'";
      return Parsimmon2(function(input, i) {
        var j = i + str.length;
        var head = input.slice(i, j);
        if (head === str) {
          return makeSuccess(j, head);
        } else {
          return makeFailure(i, expected);
        }
      });
    }
    function byte(b) {
      ensureBuffer();
      assertNumber(b);
      if (b > 255) {
        throw new Error(
          "Value specified to byte constructor (" + b + "=0x" + b.toString(16) + ") is larger in value than a single byte."
        );
      }
      var expected = (b > 15 ? "0x" : "0x0") + b.toString(16);
      return Parsimmon2(function(input, i) {
        var head = get(input, i);
        if (head === b) {
          return makeSuccess(i + 1, head);
        } else {
          return makeFailure(i, expected);
        }
      });
    }
    function regexp(re, group) {
      assertRegexp(re);
      if (arguments.length >= 2) {
        assertNumber(group);
      } else {
        group = 0;
      }
      var anchored = anchoredRegexp(re);
      var expected = "" + re;
      return Parsimmon2(function(input, i) {
        var match = anchored.exec(input.slice(i));
        if (match) {
          if (0 <= group && group <= match.length) {
            var fullMatch = match[0];
            var groupMatch = match[group];
            return makeSuccess(i + fullMatch.length, groupMatch);
          }
          var message = "valid match group (0 to " + match.length + ") in " + expected;
          return makeFailure(i, message);
        }
        return makeFailure(i, expected);
      });
    }
    function succeed(value) {
      return Parsimmon2(function(input, i) {
        return makeSuccess(i, value);
      });
    }
    function fail(expected) {
      return Parsimmon2(function(input, i) {
        return makeFailure(i, expected);
      });
    }
    function lookahead(x) {
      if (isParser(x)) {
        return Parsimmon2(function(input, i) {
          var result = x._(input, i);
          result.index = i;
          result.value = "";
          return result;
        });
      } else if (typeof x === "string") {
        return lookahead(string(x));
      } else if (x instanceof RegExp) {
        return lookahead(regexp(x));
      }
      throw new Error("not a string, regexp, or parser: " + x);
    }
    function notFollowedBy(parser2) {
      assertParser(parser2);
      return Parsimmon2(function(input, i) {
        var result = parser2._(input, i);
        var text = input.slice(i, result.index);
        return result.status ? makeFailure(i, 'not "' + text + '"') : makeSuccess(i, null);
      });
    }
    function test(predicate) {
      assertFunction(predicate);
      return Parsimmon2(function(input, i) {
        var char = get(input, i);
        if (i < input.length && predicate(char)) {
          return makeSuccess(i + 1, char);
        } else {
          return makeFailure(i, "a character/byte matching " + predicate);
        }
      });
    }
    function oneOf(str) {
      var expected = str.split("");
      for (var idx = 0; idx < expected.length; idx++) {
        expected[idx] = "'" + expected[idx] + "'";
      }
      return test(function(ch) {
        return str.indexOf(ch) >= 0;
      }).desc(expected);
    }
    function noneOf(str) {
      return test(function(ch) {
        return str.indexOf(ch) < 0;
      }).desc("none of '" + str + "'");
    }
    function custom(parsingFunction) {
      return Parsimmon2(parsingFunction(makeSuccess, makeFailure));
    }
    function range(begin, end2) {
      return test(function(ch) {
        return begin <= ch && ch <= end2;
      }).desc(begin + "-" + end2);
    }
    function takeWhile(predicate) {
      assertFunction(predicate);
      return Parsimmon2(function(input, i) {
        var j = i;
        while (j < input.length && predicate(get(input, j))) {
          j++;
        }
        return makeSuccess(j, input.slice(i, j));
      });
    }
    function lazy(desc, f) {
      if (arguments.length < 2) {
        f = desc;
        desc = void 0;
      }
      var parser2 = Parsimmon2(function(input, i) {
        parser2._ = f()._;
        return parser2._(input, i);
      });
      if (desc) {
        return parser2.desc(desc);
      } else {
        return parser2;
      }
    }
    function empty() {
      return fail("fantasy-land/empty");
    }
    _.concat = _.or;
    _.empty = empty;
    _.of = succeed;
    _["fantasy-land/ap"] = _.ap;
    _["fantasy-land/chain"] = _.chain;
    _["fantasy-land/concat"] = _.concat;
    _["fantasy-land/empty"] = _.empty;
    _["fantasy-land/of"] = _.of;
    _["fantasy-land/map"] = _.map;
    var index = Parsimmon2(function(input, i) {
      return makeSuccess(i, makeLineColumnIndex(input, i));
    });
    var any = Parsimmon2(function(input, i) {
      if (i >= input.length) {
        return makeFailure(i, "any character/byte");
      }
      return makeSuccess(i + 1, get(input, i));
    });
    var all = Parsimmon2(function(input, i) {
      return makeSuccess(input.length, input.slice(i));
    });
    var eof = Parsimmon2(function(input, i) {
      if (i < input.length) {
        return makeFailure(i, "EOF");
      }
      return makeSuccess(i, null);
    });
    var digit = regexp(/[0-9]/).desc("a digit");
    var digits = regexp(/[0-9]*/).desc("optional digits");
    var letter = regexp(/[a-z]/i).desc("a letter");
    var letters = regexp(/[a-z]*/i).desc("optional letters");
    var optWhitespace = regexp(/\s*/).desc("optional whitespace");
    var whitespace = regexp(/\s+/).desc("whitespace");
    var cr = string("\r");
    var lf = string("\n");
    var crlf = string("\r\n");
    var newline = alt(crlf, lf, cr).desc("newline");
    var end = alt(newline, eof);
    Parsimmon2.all = all;
    Parsimmon2.alt = alt;
    Parsimmon2.any = any;
    Parsimmon2.cr = cr;
    Parsimmon2.createLanguage = createLanguage;
    Parsimmon2.crlf = crlf;
    Parsimmon2.custom = custom;
    Parsimmon2.digit = digit;
    Parsimmon2.digits = digits;
    Parsimmon2.empty = empty;
    Parsimmon2.end = end;
    Parsimmon2.eof = eof;
    Parsimmon2.fail = fail;
    Parsimmon2.formatError = formatError;
    Parsimmon2.index = index;
    Parsimmon2.isParser = isParser;
    Parsimmon2.lazy = lazy;
    Parsimmon2.letter = letter;
    Parsimmon2.letters = letters;
    Parsimmon2.lf = lf;
    Parsimmon2.lookahead = lookahead;
    Parsimmon2.makeFailure = makeFailure;
    Parsimmon2.makeSuccess = makeSuccess;
    Parsimmon2.newline = newline;
    Parsimmon2.noneOf = noneOf;
    Parsimmon2.notFollowedBy = notFollowedBy;
    Parsimmon2.of = succeed;
    Parsimmon2.oneOf = oneOf;
    Parsimmon2.optWhitespace = optWhitespace;
    Parsimmon2.Parser = Parsimmon2;
    Parsimmon2.range = range;
    Parsimmon2.regex = regexp;
    Parsimmon2.regexp = regexp;
    Parsimmon2.sepBy = sepBy;
    Parsimmon2.sepBy1 = sepBy1;
    Parsimmon2.seq = seq;
    Parsimmon2.seqMap = seqMap;
    Parsimmon2.seqObj = seqObj;
    Parsimmon2.string = string;
    Parsimmon2.succeed = succeed;
    Parsimmon2.takeWhile = takeWhile;
    Parsimmon2.test = test;
    Parsimmon2.whitespace = whitespace;
    Parsimmon2["fantasy-land/empty"] = empty;
    Parsimmon2["fantasy-land/of"] = succeed;
    Parsimmon2.Binary = {
      bitSeq,
      bitSeqObj,
      byte,
      buffer: parseBuffer,
      encodedString,
      uintBE,
      uint8BE: uintBE(1),
      uint16BE: uintBE(2),
      uint32BE: uintBE(4),
      uintLE,
      uint8LE: uintLE(1),
      uint16LE: uintLE(2),
      uint32LE: uintLE(4),
      intBE,
      int8BE: intBE(1),
      int16BE: intBE(2),
      int32BE: intBE(4),
      intLE,
      int8LE: intLE(1),
      int16LE: intLE(2),
      int32LE: intLE(4),
      floatBE: floatBE(),
      floatLE: floatLE(),
      doubleBE: doubleBE(),
      doubleLE: doubleLE()
    };
    module.exports = Parsimmon2;
  }
});

// ../../core/dist/plugin/createPlugin.js
function createPlugin(callback) {
  return (settings) => (env) => callback({ settings, env });
}

// src/settings.ts
function throwIfInvalidSettings(settings) {
  if (settings.pathPattern === void 0) {
    throw new Error(
      "The pathPattern setting must be defined and include the {language} placeholder. An example would be './resources/{language}.json'."
    );
  } else if (settings.pathPattern.includes("{language}") === false) {
    throw new Error(
      "The pathPattern setting must be defined and include the {language} placeholder. An example would be './resources/{language}.json'."
    );
  } else if (settings.pathPattern.endsWith(".json") === false) {
    throw new Error(
      "The pathPattern setting must end with '.json'. An example would be './resources/{language}.json'."
    );
  }
}

// src/plugin.ts
var import_lodash = __toESM(require_lodash(), 1);

// src/helper.ts
var addNestedKeys = (obj, parentKeys, keyName, value) => {
  if (!parentKeys || parentKeys.length === 0) {
    obj[keyName] = value;
  } else if (parentKeys.length === 1) {
    obj[parentKeys[0]] = { [keyName]: value };
  } else {
    if (!obj[parentKeys[0]]) {
      obj[parentKeys[0]] = {};
    }
    addNestedKeys(obj[parentKeys[0]], parentKeys.slice(1), keyName, value);
  }
};
var detectJsonSpacing = (jsonString) => {
  const patterns = [
    {
      spacing: 1,
      regex: /^{\n {1}[^ ]+.*$/m
    },
    {
      spacing: 2,
      regex: /^{\n {2}[^ ]+.*$/m
    },
    {
      spacing: 3,
      regex: /^{\n {3}[^ ]+.*$/m
    },
    {
      spacing: 4,
      regex: /^{\n {4}[^ ]+.*$/m
    },
    {
      spacing: 6,
      regex: /^{\n {6}[^ ]+.*$/m
    },
    {
      spacing: 8,
      regex: /^{\n {8}[^ ]+.*$/m
    },
    {
      spacing: "	",
      regex: /^{\n\t[^ ]+.*$/m
    }
  ];
  for (const { spacing, regex } of patterns) {
    if (regex.test(jsonString)) {
      return spacing;
    }
  }
  return 2;
};
var collectStringsWithParents = (obj, parents = [], fileName) => {
  const results = [];
  if (typeof obj === "string") {
    results.push({
      value: obj,
      parents: parents.length > 1 ? parents.slice(0, -1) : void 0,
      id: fileName ? fileName + "." + parents.join(".") : parents.join("."),
      keyName: parents.at(-1)
    });
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentParents = [...parents, key];
        const childResults = collectStringsWithParents(obj[key], currentParents, fileName);
        results.push(...childResults);
      }
    }
  }
  return results;
};

// src/ideExtension/messageReferenceMatchers.ts
var import_parsimmon = __toESM(require_parsimmon(), 1);
var parser = import_parsimmon.default.createLanguage({
  // The entry point for message reference matching.
  //
  // 1. Match a t function call or any other character.
  // 2. Match as many of these as possible.
  // 3. Filter out any non-object matches.
  entry: (r) => {
    return import_parsimmon.default.alt(r.tFunctionCall, import_parsimmon.default.any).many().map((matches) => {
      return matches.filter((match) => typeof match === "object");
    });
  },
  // A string literal is either a single or double quoted string
  stringLiteral: (r) => {
    return import_parsimmon.default.alt(r.doubleQuotedString, r.singleQuotedString);
  },
  // Double quoted string literal parser
  //
  // 1. Start with a double quote.
  // 2. Then match any character that is not a double quote.
  // 3. End with a double quote.
  doubleQuotedString: () => {
    return import_parsimmon.default.string('"').then(import_parsimmon.default.regex(/[^"]*/)).skip(import_parsimmon.default.string('"'));
  },
  // Single quoted string literal parser
  //
  // 1. Start with a single quote.
  // 2. Then match any character that is not a single quote.
  // 3. End with a single quote.
  singleQuotedString: () => {
    return import_parsimmon.default.string("'").then(import_parsimmon.default.regex(/[^']*/)).skip(import_parsimmon.default.string("'"));
  },
  // Parser for t function calls
  tFunctionCall: function(r) {
    return import_parsimmon.default.seqMap(
      import_parsimmon.default.string("t"),
      // starts with t
      import_parsimmon.default.string("("),
      // then an opening parenthesis
      import_parsimmon.default.index,
      // start position of the message id
      r.stringLiteral,
      // message id
      import_parsimmon.default.index,
      // end position of the message id
      import_parsimmon.default.regex(/[^)]*/),
      // ignore the rest of the function call
      import_parsimmon.default.string(")"),
      // end with a closing parenthesis
      (_, __, start, messageId, end) => {
        return {
          messageId,
          position: {
            start: {
              line: start.line,
              character: start.column
            },
            end: {
              line: end.line,
              character: end.column
            }
          }
        };
      }
    );
  }
});
function parse(sourceCode) {
  try {
    return parser.entry.tryParse(sourceCode);
  } catch {
    return [];
  }
}

// src/ideExtension/config.ts
var ideExtensionConfig = {
  messageReferenceMatchers: [
    async (args) => {
      return parse(args.documentText);
    }
  ],
  extractMessageOptions: [
    {
      callback: (messageId) => `{t("${messageId}")}`
    }
  ],
  documentSelectors: [
    {
      language: "javascript"
    },
    {
      language: "typescript"
    },
    {
      language: "svelte"
    }
  ]
};

// src/plugin.ts
var plugin = createPlugin(({ settings, env }) => ({
  id: "inlang.plugin-i18next",
  async config() {
    throwIfInvalidSettings(settings);
    return {
      languages: await getLanguages({
        $fs: env.$fs,
        settings
      }),
      readResources: (args) => readResources({
        ...args,
        $fs: env.$fs,
        settings
      }),
      writeResources: (args) => writeResources({
        ...args,
        $fs: env.$fs,
        settings
      }),
      ideExtension: ideExtensionConfig
    };
  }
}));
async function getLanguages(args) {
  const [pathBeforeLanguage] = args.settings.pathPattern.split("{language}");
  const paths = await args.$fs.readdir(pathBeforeLanguage);
  const languages = [];
  for (const language of paths) {
    if (!language.includes(".")) {
      const languagefiles = await args.$fs.readdir(`${pathBeforeLanguage}${language}`);
      if (languagefiles.length === 0) {
        languages.push(language);
      } else {
        for (const languagefile of languagefiles) {
          if (languagefile.endsWith(".json") && !args.settings.ignore?.some((s) => s === language) && !languages.includes(language)) {
            languages.push(language);
          }
        }
      }
    } else if (language.endsWith(".json") && !args.settings.ignore?.some((s) => s === language)) {
      languages.push(language.replace(".json", ""));
    }
  }
  return languages;
}
async function readResources(args) {
  const result = [];
  const languages = await getLanguages(args);
  for (const language of languages) {
    const resourcePath = args.settings.pathPattern.replace("{language}", language);
    try {
      const stringifiedFile = await args.$fs.readFile(resourcePath, {
        encoding: "utf-8"
      });
      const space = detectJsonSpacing(
        await args.$fs.readFile(resourcePath, {
          encoding: "utf-8"
        })
      );
      const extendedMessages = collectStringsWithParents(JSON.parse(stringifiedFile));
      let parsedMassagesForAst = {};
      extendedMessages.map((message) => {
        parsedMassagesForAst = {
          ...parsedMassagesForAst,
          ...{
            [message.id]: {
              value: message.value,
              parents: message.parents,
              keyName: message.keyName
            }
          }
        };
      });
      result.push(
        parseResource(
          parsedMassagesForAst,
          language,
          space,
          args.settings.variableReferencePattern ? args.settings.variableReferencePattern : ["{{", "}}"]
        )
      );
    } catch {
      let obj = {};
      const path = `${resourcePath.replace("/*.json", "")}`;
      const files = await args.$fs.readdir(path);
      const space = files.length === 0 ? 2 : detectJsonSpacing(
        await args.$fs.readFile(`${path}/${files[0]}`, {
          encoding: "utf-8"
        })
      );
      if (files.length !== 0) {
        for (const languagefile of files) {
          const stringifiedFile = await args.$fs.readFile(`${path}/${languagefile}`, {
            encoding: "utf-8"
          });
          const fileName = languagefile.replace(".json", "");
          const extendedMessages = collectStringsWithParents(
            JSON.parse(stringifiedFile),
            [],
            fileName
          );
          let parsedMassagesForAst = {};
          extendedMessages.map((message) => {
            parsedMassagesForAst = {
              ...parsedMassagesForAst,
              ...{
                [message.id]: {
                  value: message.value,
                  parents: message.parents,
                  fileName,
                  keyName: message.keyName
                }
              }
            };
          });
          obj = {
            ...obj,
            ...parsedMassagesForAst
          };
        }
      }
      result.push(
        parseResource(
          obj,
          language,
          space,
          args.settings.variableReferencePattern ? args.settings.variableReferencePattern : ["{{", "}}"]
        )
      );
    }
  }
  return result;
}
function parseResource(messages, language, space, variableReferencePattern) {
  return {
    type: "Resource",
    metadata: {
      space
    },
    languageTag: {
      type: "LanguageTag",
      name: language
    },
    body: Object.entries(messages).map(
      ([id, value]) => parseMessage(id, value, variableReferencePattern)
    )
  };
}
function parseMessage(id, extendedMessage, variableReferencePattern) {
  const regex = variableReferencePattern && (variableReferencePattern[1] ? new RegExp(
    `(\\${variableReferencePattern[0]}[^\\${variableReferencePattern[1]}]+\\${variableReferencePattern[1]})`,
    "g"
  ) : new RegExp(`(${variableReferencePattern}\\w+)`, "g"));
  const newElements = [];
  if (regex) {
    const splitArray = extendedMessage.value.split(regex);
    for (const element of splitArray) {
      if (regex.test(element)) {
        newElements.push({
          type: "Placeholder",
          body: {
            type: "VariableReference",
            name: variableReferencePattern[1] ? element.slice(
              variableReferencePattern[0].length,
              variableReferencePattern[1].length * -1
            ) : element.slice(variableReferencePattern[0].length)
          }
        });
      } else {
        if (element !== "") {
          newElements.push({
            type: "Text",
            value: element
          });
        }
      }
    }
  } else {
    newElements.push({
      type: "Text",
      value: extendedMessage.value
    });
  }
  return {
    type: "Message",
    metadata: {
      ...extendedMessage.fileName !== void 0 && {
        fileName: extendedMessage.fileName
      },
      ...extendedMessage.parents !== void 0 && {
        parentKeys: extendedMessage.parents
      },
      ...extendedMessage.keyName !== void 0 && {
        keyName: extendedMessage.keyName
      }
    },
    id: {
      type: "Identifier",
      name: id
    },
    pattern: {
      type: "Pattern",
      elements: newElements
    }
  };
}
async function writeResources(args) {
  for (const resource of args.resources) {
    const resourcePath = args.settings.pathPattern.replace("{language}", resource.languageTag.name);
    const space = resource.metadata?.space || 2;
    if (resource.body.length === 0) {
      if (resourcePath.split(resource.languageTag.name.toString())[1].includes("/")) {
        await args.$fs.mkdir(
          resourcePath.replace(
            resourcePath.split(resource.languageTag.name.toString())[1].toString(),
            ""
          )
        );
        if (!resourcePath.includes("/*.json")) {
          await args.$fs.writeFile(resourcePath, JSON.stringify({}, void 0, space));
        }
      } else {
        await args.$fs.writeFile(resourcePath, JSON.stringify({}, void 0, space));
      }
    } else if (resourcePath.includes("/*.json")) {
      const clonedResource = resource.body.length === 0 ? {} : JSON.parse(JSON.stringify(resource.body));
      const fileNames = [];
      clonedResource.map((message) => {
        if (!message.metadata?.fileName) {
          fileNames.push(message.id.name.split(".")[0]);
        } else if (message.metadata?.fileName && !fileNames.includes(message.metadata?.fileName)) {
          fileNames.push(message.metadata?.fileName);
        }
      });
      for (const fileName of fileNames) {
        const filteredMassages = clonedResource.filter((message) => message.id.name.startsWith(fileName)).map((message) => {
          return {
            ...message,
            id: {
              ...message.id,
              name: message.id.name.replace(`${fileName}.`, "")
            }
          };
        });
        const splitedResource = {
          type: resource.type,
          languageTag: resource.languageTag,
          body: filteredMassages
        };
        await args.$fs.writeFile(
          resourcePath.replace("*", fileName),
          serializeResource(
            splitedResource,
            space,
            args.settings.variableReferencePattern ? args.settings.variableReferencePattern : ["{{", "}}"]
          )
        );
      }
    } else {
      await args.$fs.writeFile(
        resourcePath,
        serializeResource(
          resource,
          space,
          args.settings.variableReferencePattern ? args.settings.variableReferencePattern : ["{{", "}}"]
        )
      );
    }
  }
}
function serializeResource(resource, space, variableReferencePattern) {
  const obj = {};
  for (const message of resource.body) {
    const returnedJsonMessage = serializeMessage(message, variableReferencePattern);
    (0, import_lodash.default)(obj, returnedJsonMessage);
  }
  return JSON.stringify(obj, void 0, space);
}
var serializeMessage = (message, variableReferencePattern) => {
  const newStringArr = [];
  for (const element of message.pattern.elements) {
    if (element.type === "Text" || !variableReferencePattern) {
      newStringArr.push(element.value);
    } else if (element.type === "Placeholder") {
      variableReferencePattern[1] ? newStringArr.push(
        `${variableReferencePattern[0]}${element.body.name}${variableReferencePattern[1]}`
      ) : newStringArr.push(`${variableReferencePattern[0]}${element.body.name}`);
    }
  }
  const newString = newStringArr.join("");
  const newObj = {};
  if (message.metadata?.keyName) {
    addNestedKeys(newObj, message.metadata?.parentKeys, message.metadata?.keyName, newString);
  } else if (message.metadata?.fileName) {
    newObj[message.id.name.split(".").slice(1).join(".")] = newString;
  } else {
    newObj[message.id.name] = newString;
  }
  return newObj;
};
export {
  plugin as default
};
//! DON'T TOP-LEVEL IMPORT ESBUILD PLUGINS. USE DYNAMIC IMPORTS.
//! See https://github.com/inlang/inlang/issues/486
