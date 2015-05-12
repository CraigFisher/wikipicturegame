from django.shortcuts import render
from game.wikipediaclient import generateQuestion
from django.http import HttpResponse
import json


def home(request):
    if request.method == "GET":
        # category = 'Category:A_priori'
        # category = 'Category:1955_deaths'
        category = 'Category:California_counties'
        # category = 'Category:Basic_concepts_in_infinite_set_theory'
        # category = 'Category:Compactness_(mathematics)'
        debugText = ""
        question = {}

        try:
            question = generateQuestion(category)
        except ValueError as e:
            debugText = str(e)

        context = {'question': question}
        if debugText:
            context['debugText'] = debugText
        if question:
            context['question'] = question

        return render(request, 'game/game.html', context)

    if request.method == "POST":
        if request.is_ajax():
            choiceId = request.body
            responseDict = {'dummyReponseWithId': choiceId}
            import pdb; pdb.set_trace()  # breakpoint 91094231 //
            data = json.dumps(responseDict)
            import pdb; pdb.set_trace()  # breakpoint fa8708bb //
            return HttpResponse(data, mimetype='application/json')
