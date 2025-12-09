FROM openresty/openresty:bookworm-fat
EXPOSE 8080

RUN groupadd -r openresty 2>/dev/null && \
    useradd -r -g openresty -s /sbin/nologin -c "OpenResty user" openresty 2>/dev/null

RUN opm install lua-resty-openssl lua-resty-http

COPY nginx.conf /etc/nginx/openresty.conf
COPY lua/ /etc/nginx/lua/

USER openresty
CMD ["/usr/bin/openresty", "-c", "/etc/nginx/openresty.conf", "-g", "daemon off;"]
