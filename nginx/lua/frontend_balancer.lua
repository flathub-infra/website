local balancer = require "ngx.balancer"
local resolver = require "resty.dns.resolver"

local _M = {}

local HEADLESS_SVC = "frontend-headless.flathub.svc.cluster.local"
local PORT = 3000
local DNS_TTL = 10
local VNODES = 150

local cached_backends = nil
local cached_ring = nil
local cache_expiry = 0

local function resolve_backends()
    local now = ngx.now()
    if cached_backends and now < cache_expiry then
        return cached_backends, cached_ring
    end

    local r, err = resolver:new({
        nameservers = {"172.30.0.10"},
        retrans = 2,
        timeout = 2000,
    })
    if not r then
        if cached_backends then
            return cached_backends, cached_ring
        end
        return nil, nil, "failed to create resolver: " .. (err or "unknown")
    end

    local answers, err = r:query(HEADLESS_SVC, { qtype = r.TYPE_A })
    if not answers or answers.errcode then
        if cached_backends then
            return cached_backends, cached_ring
        end
        return nil, nil, "DNS query failed: " .. (err or "unknown")
    end

    local backends = {}
    for _, ans in ipairs(answers) do
        if ans.type == r.TYPE_A then
            backends[#backends + 1] = ans.address
        end
    end

    if #backends == 0 then
        if cached_backends then
            return cached_backends, cached_ring
        end
        return nil, nil, "no backends resolved"
    end

    table.sort(backends)

    local ring = {}
    for _, addr in ipairs(backends) do
        for j = 1, VNODES do
            local hash = ngx.crc32_long(addr .. "-" .. j)
            ring[#ring + 1] = { hash = hash, addr = addr }
        end
    end
    table.sort(ring, function(a, b) return a.hash < b.hash end)

    cached_backends = backends
    cached_ring = ring
    cache_expiry = now + DNS_TTL

    return backends, ring
end

local function pick_backend(ring, key)
    local hash = ngx.crc32_long(key)

    local lo, hi = 1, #ring
    while lo < hi do
        local mid = math.floor((lo + hi) / 2)
        if ring[mid].hash < hash then
            lo = mid + 1
        else
            hi = mid
        end
    end

    if ring[lo].hash < hash then
        return ring[1].addr
    end
    return ring[lo].addr
end

function _M.balance()
    local backends, ring, err = resolve_backends()
    if not backends then
        ngx.log(ngx.ERR, "frontend balancer: ", err)
        return ngx.exit(502)
    end

    local uri = ngx.var.request_uri
    local addr = pick_backend(ring, uri)

    local ok, err = balancer.set_current_peer(addr, PORT)
    if not ok then
        ngx.log(ngx.ERR, "failed to set peer: ", err)
        return ngx.exit(502)
    end
end

return _M
