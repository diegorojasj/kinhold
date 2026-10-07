from django.urls import path
from src.controllers.api import api

urlpatterns = [path("api/money/", api.urls)]
