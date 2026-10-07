from django.urls import path
from src.controllers.api import api

urlpatterns = [path("api/shopping/", api.urls)]
