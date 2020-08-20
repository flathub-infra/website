FROM python:3.8

EXPOSE 8080
ENV PYTHONPATH=/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential libcairo2-dev libgirepository1.0-dev \
        gir1.2-ostree-1.0 flatpak
ADD requirements.txt /requirements.txt
RUN pip install -r requirements.txt && rm -f /requirements.txt

COPY ./app /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
