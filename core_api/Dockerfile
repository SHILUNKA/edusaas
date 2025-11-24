FROM rust:latest

# --- 1. Cargo 镜像源 ---
RUN mkdir -p ${CARGO_HOME:-/usr/local/cargo}/
RUN echo '[source.crates-io]' > ${CARGO_HOME:-/usr/local/cargo}/config.toml && \
    echo 'replace-with = "ustc"' >> ${CARGO_HOME:-/usr/local/cargo}/config.toml && \
    echo '' >> ${CARGO_HOME:-/usr/local/cargo}/config.toml && \
    echo '[source.ustc]' >> ${CARGO_HOME:-/usr/local/cargo}/config.toml && \
    echo 'registry = "https://mirrors.ustc.edu.cn/crates.io-index"' >> ${CARGO_HOME:-/usr/local/cargo}/config.toml

WORKDIR /app

# 安装 watch 工具
RUN cargo install cargo-watch

# --- 2. 关键修复：(修正顺序) ---
# 我们只复制 Cargo.toml。
COPY Cargo.toml ./

# (★ 关键修复 ★)
# 我们必须在 "cargo fetch" 之前创建一个“假的” main.rs，
# 否则 cargo 会抱怨 "no targets specified"。
RUN mkdir -p src && echo "fn main(){}" > src/main.rs

# 这一步现在会 100% 正确地获取所有依赖 (包括 sqlx+rust_decimal)
RUN cargo fetch

# 我们预先构建一个空项目, 来缓存所有依赖的编译
RUN cargo build --release
RUN rm -rf src

# 复制我们真正的源代码
COPY src ./src

# --- 3. 启动命令 ---
CMD ["cargo-watch", "--poll", "-x", "run"]