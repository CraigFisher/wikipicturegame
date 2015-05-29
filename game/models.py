from django.db import models


class WikipediaCategory(models.Model):
    title = models.CharField(max_length=1000)
