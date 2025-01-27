# 使用 Python 作为基础镜像
FROM python:3.12-slim AS backend

# 设置工作目录
WORKDIR /app

# 复制后端的 requirements.txt 并安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端源代码
COPY src/ /app/src/

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# 创建必要的目录
RUN mkdir -p /app/uploads

# 暴露后端端口
EXPOSE 8765

# 使用 Node.js 作为基础镜像
FROM node:18 AS frontend

# 设置工作目录
WORKDIR /app/frontend

# 复制前端的 package.json 和 package-lock.json 并安装依赖
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# 复制前端源代码
COPY frontend/ ./

# 构建前端应用
RUN npm run build

# 使用 Apache 作为生产环境的服务器
FROM httpd:alpine

# 复制构建好的前端文件到 Apache 的 html 目录
COPY --from=frontend /app/frontend/build /usr/local/apache2/htdocs/

# 复制后端代码到 Apache 镜像中
COPY --from=backend /app /app

# 复制 Apache 配置文件
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

# 启动 Apache
CMD ["httpd-foreground"] 