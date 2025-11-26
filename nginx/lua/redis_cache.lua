local redis = require "resty.redis"
local cjson = require "cjson.safe"

local _M = {}

local function get_redis_host()
    return os.getenv("REDIS_HOST") or "redis"
end

local function get_redis_port()
    return tonumber(os.getenv("REDIS_PORT")) or 6379
end

local function encode_sorted_json(tbl)
    if type(tbl) ~= "table" then
        return cjson.encode(tbl)
    end

    local keys = {}
    for k in pairs(tbl) do
        table.insert(keys, k)
    end
    table.sort(keys)

    local sorted_parts = {}
    table.insert(sorted_parts, "{")

    for i, key in ipairs(keys) do
        if i > 1 then
            table.insert(sorted_parts, ",")
        end

        table.insert(sorted_parts, '"' .. key .. '":')

        local value = tbl[key]
        if type(value) == "table" then
            table.insert(sorted_parts, encode_sorted_json(value))
        else
            table.insert(sorted_parts, cjson.encode(value))
        end
    end

    table.insert(sorted_parts, "}")
    return table.concat(sorted_parts)
end

local function connect_redis()
    local red = redis:new()
    red:set_timeout(1000)

    local ok, err = red:connect(get_redis_host(), get_redis_port())
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil
    end

    return red
end

local function set_keepalive(red)
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

local routes = {
    {"^/api/v2/eol/rebase$", "get_eol_rebase", function(match, args)
        return {}
    end},
    {"^/api/v2/eol/rebase/([^/]+)$", "get_eol_rebase_appid", function(match, args)
        return {app_id = match[1], branch = args.branch or "stable"}
    end},
    {"^/api/v2/eol/message$", "get_eol_message", function(match, args)
        return {}
    end},
    {"^/api/v2/eol/message/([^/]+)$", "get_eol_message_appid", function(match, args)
        return {app_id = match[1], branch = args.branch or "stable"}
    end},
    {"^/api/v2/appstream$", "list_appstream", function(match, args)
        return {filter = args.filter or "apps", sort = args.sort or "alphabetical"}
    end},
    {"^/api/v2/appstream/([^/]+)$", "get_appstream", function(match, args)
        return {app_id = match[1], locale = args.locale or "en"}
    end},
    {"^/api/v2/summary/([^/]+)$", "get_summary", function(match, args)
        local params = {app_id = match[1]}
        if args.branch then
            params.branch = args.branch
        end
        return params
    end},
    {"^/api/v2/verification/([^/]+)/status$", "get_verification_status", function(match, args)
        return {app_id = match[1]}
    end},
}

local function build_cache_key(uri, args)
    for _, route in ipairs(routes) do
        local pattern, func_name, param_builder = route[1], route[2], route[3]
        local matches = {string.match(uri, pattern)}

        if #matches > 0 or uri:match(pattern) then
            local kwargs = param_builder(matches, args)
            local key_data = {func = func_name, kwargs = kwargs}
            local json_str = encode_sorted_json(key_data)
            local key_hash = ngx.md5(json_str)
            return "cache:endpoint:" .. func_name .. ":" .. key_hash
        end
    end

    return nil
end

local function get_from_cache(red, cache_key)
    local cached_value, err = red:get(cache_key)

    if not cached_value or cached_value == ngx.null then
        return nil
    end

    if err then
        ngx.log(ngx.ERR, "Redis get error: ", err)
        return nil
    end

    local cache_data, decode_err = cjson.decode(cached_value)
    if decode_err then
        ngx.log(ngx.ERR, "JSON decode error: ", decode_err)
        return nil
    end

    return cache_data
end

function _M.try_cache()
    local red = connect_redis()
    if not red then
        return
    end

    local cache_key = build_cache_key(ngx.var.uri, ngx.req.get_uri_args())
    if not cache_key then
        set_keepalive(red)
        return
    end

    local cached_data = get_from_cache(red, cache_key)
    set_keepalive(red)

    if cached_data and cached_data.value then
        ngx.header["Content-Type"] = "application/json"
        ngx.header["X-Cache-Status"] = "HIT"
        ngx.say(cjson.encode(cached_data.value))
        ngx.exit(ngx.HTTP_OK)
    end
end

return _M
