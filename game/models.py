from django.db import models


class WikipediaCategory(models.Model):
    title = models.CharField(max_length=1000, unique=True)


class RowCounts(models.Model):
    tablename = models.CharField(max_length=100)
    rowcount = models.BigIntegerField()
