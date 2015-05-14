from django.shortcuts import render
from game.wikipediaclient import generateQuestion
from django.http import HttpResponse
import json


def home(request):
    if request.method == "GET":

        # TODO: NO LONGER HARDCODE CATEGORY

        # category = 'Category:A_priori'
        # category = 'Category:1955_deaths'
        # category = 'Category:California_counties'
        # category = 'Category:Basic_concepts_in_infinite_set_theory'
        # category = 'Category:Compactness_(mathematics)'
        # debugText = ""
        # question = {}

        # try:
            # question = generateQuestion(category)
        # except ValueError as e:
            # debugText = str(e)

        context = {}
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
