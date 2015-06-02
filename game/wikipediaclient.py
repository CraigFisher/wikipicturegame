import requests


WIKIPEDIA_ENDPOINT = 'http://en.wikipedia.org/w/api.php?'
WP_QUERY_MAX = 500  # Maximum results for regular user per individual query, as specified by Wikipedia.
WP_THUMBNAIL_QUERY_MAX = 50  # Maximum per query, set by Wikipedia
WP_CATEGORY_NAMESPACE = 14
WP_MAIN_NAMESPACE = 0


# Paraphrased from http://www.mediawiki.org/wiki/API:Query#Generators
def query(request):
    request['action'] = 'query'
    request['format'] = 'json'
    request['maxlag'] = 5
    lastContinue = {'continue': ''}

    while True:
        # Clone original request
        req = request.copy()
        # Modify it with the values returned in the 'continue' section of the last result.
        req.update(lastContinue)
        # Call API
        result = requests.get('http://en.wikipedia.org/w/api.php', params=req).json()
        if 'error' in result:
            raise ValueError("Failed to retrieve category pages!")
        if 'warnings' in result:
            print(result['warnings'])
        if 'query' in result:
            yield result['query']
        if 'continue' not in result:
            break
        lastContinue = result['continue']


# Earlier version of above query function,
# remaining here so as not to break questionmaker.py
# (which also contains legacy code)
def legacyQuery(request, limitParam, selectionNumber):
    request['action'] = 'query'
    request['format'] = 'json'
    lastContinue = {'continue': ''}

    if selectionNumber > WP_QUERY_MAX:
        request[limitParam] = WP_QUERY_MAX
    else:
        request[limitParam] = selectionNumber
    resultsRemaining = selectionNumber

    while resultsRemaining > 0:
        # Clone original request
        req = request.copy()
        # Modify it with the values returned in the 'continue' section of the last result.
        req.update(lastContinue)
        # Call API
        result = requests.get('http://en.wikipedia.org/w/api.php', params=req).json()
        resultsRemaining -= WP_QUERY_MAX

        if 'error' in result:
            raise ValueError("Failed to retrieve category pages!")
        if 'warnings' in result:
            print(result['warnings'])
        if 'query' in result:
            yield result['query']
        if 'continue' not in result:
            break
        lastContinue = result['continue']


# Legacy single-category question maker.
#   Now supplanted by client side question maker.
#   May be recycled in the future.
import string
import random


def makeQuestion(category):
    request = {
        'prop': 'pageimages|info',
        'inprop': 'url',
        'piprop': 'original',
        'pilimit': WP_THUMBNAIL_QUERY_MAX,
        'generator': 'categorymembers',
        'gcmprop': 'ids',
        'gcmnamespace': 0,
        'gcmsort': 'sortkey'
    }

    startingCharacterIndex = random.randint(0, 25)
    # If character is in first half of alphabet,
    # return results in ascending order and visa versa
    if startingCharacterIndex <= 12:
        request['gcmdir'] = 'asc'
    else:
        request['gcmdir'] = 'desc'
    startingCharacter = string.ascii_lowercase[startingCharacterIndex]
    request['gcmtitle'] = category
    request['gcmstartsortkeyprefix'] = startingCharacter

    response_1 = next(legacyQuery(request, 'gcmlimit', WP_QUERY_MAX))  # Only first result set is used
    pages_1 = response_1['pages']

    thumbnail = ""
    keys_1 = list(pages_1.keys())
    random.shuffle(keys_1)
    answerKey = ""
    for key in keys_1:
        try:
            thumbnail = pages_1[key]['thumbnail']['original']
            answerTitle = pages_1[key]['title']
            answerUrl = pages_1[key]['fullurl']
            answerKey = key
            break
        except KeyError:
            pass

    # A second query may be required
    if not thumbnail or len(pages_1) < 5:
        # If a thumbnail hasn't been found among the first 500 pages, give up.
        if not thumbnail and len(pages_1) >= 500:
            raise ValueError("Could not find thumbnail images for this category.")

        # Otherwise, search again from the same starting letter in the opposite direction
        if request['gcmdir'] == 'asc':
            request['gcmdir'] = 'desc'
        else:
            request['gcmdir'] = 'asc'

        # Send the second query.
        response_2 = next(legacyQuery(request, 'gcmlimit', WP_QUERY_MAX), None)  # Only first result set is used
        if response_2 is None:
            raise ValueError("Could not find thumbnail images for this category.")
        pages_2 = response_2['pages']

        # This category does not have enough pages to create a question.
        if len(pages_1) + len(pages_2) < 5:
            raise ValueError("Category does not have enough pages to create a question.")

        if not thumbnail:
            keys_2 = list(pages_2.keys())
            random.shuffle(keys_2)
            for key in keys_2:
                try:
                    thumbnail = pages_2[key]['thumbnail']['original']
                    answerTitle = pages_2[key]['title']
                    answerUrl = pages_2[key]['fullurl']
                    answerKey = key
                    break
                except KeyError:
                    pass

    # If thumbnail has still not been found, give up.
    if not thumbnail:
        raise ValueError("Could not find thumbnail images for this category.")

    question = {'answerKey': answerKey, 'thumbnail': thumbnail,
                'answerUrl': answerUrl, 'category': category}

    rightAnswer = {}
    rightAnswer['title'] = answerTitle
    rightAnswer['url'] = answerUrl
    rightAnswer['key'] = answerKey

    choices = []
    choices.append(rightAnswer)
    choiceCount = 1

    # Lastly, gather 4 other random pages from the same category to use as
    #       the wrong answers.
    for key in keys_1:
        if key == answerKey:
            continue
        title = pages_1[key]['title']
        url = pages_1[key]['fullurl']
        answer = {'title': title, 'url': url, 'key': key}
        choices.append(answer)

        choiceCount += 1
        if choiceCount >= 5:
            break

    if choiceCount < 5:
        for key in keys_2:
            if key == answerKey:
                break
            title = pages_1[key]['title']
            url = pages_1[key]['fullurl']
            answer = {'title': title, 'url': url, 'key': key}
            choices.append(answer)

            choiceCount += 1
            if choiceCount > 5:
                break

    random.shuffle(choices)
    question['choices'] = choices
    return question
