local balancer = require "ngx.balancer"
local resolver = require "resty.dns.resolver"

local _M = {}

local HEADLESS_SVC = "frontend-headless.flathub.svc.cluster.local"
local PORT = 3000
local VNODES = 150
local REFRESH_INTERVAL = 5

-- Per-worker cache (no sockets needed to read these in balancer phase)
local cached_ring = nil
local cached_backends_key = ""

local function build_ring(backends)
    local ring = {}
    for _, addr in ipairs(backends) do
        for j = 1, VNODES do
            local hash = ngx.crc32_long(addr .. "-" .. j)
            ring[#ring + 1] = { hash = hash, addr = addr }
        end
    end
    table.sort(ring, function(a, b) return a.hash < b.hash end)
    return ring
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

local function refresh_backends(premature)
    if premature then
        return
    end

    local r, err = resolver:new({
        nameservers = { "172.30.0.10" },
        retrans = 2,
        timeout = 2000,
    })
    if not r then
        ngx.log(ngx.ERR, "frontend_balancer: failed to create resolver: ", err)
        return
    end

    local answers, err = r:query(HEADLESS_SVC, { qtype = r.TYPE_A })
    if not answers or answers.errcode then
        ngx.log(ngx.ERR, "frontend_balancer: DNS query failed: ", err or answers.errstr)
        return
    end

    local backends = {}
    for _, ans in ipairs(answers) do
        if ans.type == r.TYPE_A then
            backends[#backends + 1] = ans.address
        end
    end

    if #backends == 0 then
        ngx.log(ngx.ERR, "frontend_balancer: no backends resolved")
        return
    end

    table.sort(backends)
    local key = table.concat(backends, ",")

    if key ~= cached_backends_key then
        ngx.log(ngx.INFO, "frontend_balancer: updating backends: ", key)
        cached_ring = build_ring(backends)
        cached_backends_key = key
    end
end

function _M.init_worker()
    local ok, err = ngx.timer.at(0, refresh_backends)
    if not ok then
        ngx.log(ngx.ERR, "frontend_balancer: failed to start initial timer: ", err)
    end

    local ok, err = ngx.timer.every(REFRESH_INTERVAL, refresh_backends)
    if not ok then
        ngx.log(ngx.ERR, "frontend_balancer: failed to start refresh timer: ", err)
    end
end

function _M.balance()
    if not cached_ring or #cached_ring == 0 then
        ngx.log(ngx.ERR, "frontend_balancer: no backends available")
        return ngx.exit(502)
    end

    local uri = ngx.var.request_uri
    local addr = pick_backend(cached_ring, uri)

    local ok, err = balancer.set_current_peer(addr, PORT)
    if not ok then
        ngx.log(ngx.ERR, "frontend_balancer: failed to set peer: ", err)
        return ngx.exit(502)
    end
end

return _M
