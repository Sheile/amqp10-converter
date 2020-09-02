FROM python:3.8-slim
MAINTAINER Nobuyuki Matsui <nobuyuki.matsui@gmail.com>

COPY ./Pipfile /opt/src/Pipfile
COPY ./Pipfile.lock /opt/src/Pipfile.lock
COPY ./consumer.py /opt/src/consumer.py
COPY ./handler.py /opt/src/handler.py
COPY ./main.py /opt/src/main.py
COPY ./producer.py /opt/src/producer.py

WORKDIR /opt/src

RUN apt update && apt upgrade -y && \
    apt install -y build-essential pkg-config libssl-dev openssl swig && \
    pip install --upgrade pip && \
    pip install pipenv && \
    pipenv lock --requirements > /opt/src/requirements.txt && \
    export LDFLAGS="-L/usr/lib"; export CFLAGS="-I/usr/include/openssl"; export CPPFLAGS="-I/usr/include/openssl"; export PKG_CONFIG_PATH="/usr/lib/pkgconfig"; pip install -r /opt/src/requirements.txt --no-cache-dir

ENTRYPOINT ["/opt/src/main.py"]
