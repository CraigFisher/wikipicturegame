from django.shortcuts import render
from game.wikipediaclient import generateQuestion
from django.http import HttpResponse
import json


def home(request):
    if request.method == "GET":
        # debugText = ""

        # TODO: NO LONGER HARDCODE CATEGORY
        categories = ['Category:1955_deaths',
                      'Category:California_counties',
                      'Category:Basic_concepts_in_infinite_set_theory']
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
