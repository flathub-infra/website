FROM openresty/openresty:bookworm-fat AS brotli

ARG NGX_BROTLI_COMMIT=a71f9312c2deb28875acc7bacfdd5695a111aa53

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential cmake curl git libpcre2-dev zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone https://github.com/google/ngx_brotli.git && \
    git -C ngx_brotli checkout "$NGX_BROTLI_COMMIT" && \
    git -C ngx_brotli submodule update --init --depth 1 && \
    cmake -S ngx_brotli/deps/brotli -B ngx_brotli/deps/brotli/out \
        -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON && \
    cmake --build ngx_brotli/deps/brotli/out --target brotlienc brotlicommon

RUN OPENRESTY_VERSION="$(openresty -v 2>&1 | sed 's|.*openresty/||')" && \
    curl -fsSL "https://openresty.org/download/openresty-${OPENRESTY_VERSION}.tar.gz" | tar xz && \
    cd openresty-"${OPENRESTY_VERSION}"/bundle/nginx-* && \
    ./configure --with-compat --add-dynamic-module=/src/ngx_brotli && \
    make modules && \
    cp objs/ngx_http_brotli_filter_module.so /src/

FROM openresty/openresty:bookworm-fat
EXPOSE 8080

RUN groupadd -r openresty 2>/dev/null && \
    useradd -r -g openresty -s /sbin/nologin -c "OpenResty user" openresty 2>/dev/null

RUN opm get ledgetech/lua-resty-http

COPY --from=brotli /src/ngx_http_brotli_filter_module.so /usr/local/openresty/nginx/modules/
COPY nginx.conf /etc/nginx/openresty.conf
COPY lua/ /etc/nginx/lua/

USER openresty
CMD ["/usr/bin/openresty", "-c", "/etc/nginx/openresty.conf", "-g", "daemon off;"]
