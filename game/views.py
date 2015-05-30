from django.shortcuts import render
from game.wikipediaclient import generateQuestion
from django.http import HttpResponse
from game.models import WikipediaCategory, RowCounts
import json


def home(request):
    if request.method == "GET":
        # debugText = ""

        # TODO: NO LONGER HARDCODE CATEGORY
        # categories = ['Category:1955_deaths',
        #             'Category:California_counties',
        #             'Category:Basic_concepts_in_infinite_set_theory']
        # context = {"categories": json.dumps(categories)}

        _INITIAL_REQUEST_SIZE = 2

        rowCount = RowCounts.objects.get(tablename='game_wikipediacategory').rowcount

        # Query paraphrased from
        # https://www.periscope.io/blog/how-to-sample-rows-in-sql-273x-faster.html
        random_category_query = "select id, title from game_wikipediacategory " \
                                "where id in ( " \
                                "select round(random() * {0})::integer as id " \
                                "from generate_series(1, {1}) " \
                                "group by id) " \
                                "limit {2} ".format(rowCount, _INITIAL_REQUEST_SIZE * 10, _INITIAL_REQUEST_SIZE)

        randomCategorySet = WikipediaCategory.objects.raw(random_category_query)
        print(randomCategorySet[0].title)
        print(randomCategorySet[1].title)

        categories = []
        for m in randomCategorySet:
            categories.append(m.title)

        context = {"categories": json.dumps(categories)}
        return render(request, 'game/game.html', context)

    if request.method == "POST":
        if request.is_ajax():
            data = json.loads(request.body.decode('utf-8'))
            category = data['category']
            try:
                question = generateQuestion(category)
                data = json.dumps(question)
            except ValueError as e:
                print(str(e))
                raise Exception
            return HttpResponse(data, content_type='application/json')
