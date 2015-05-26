"use strict";

var getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
};

var shuffle = function(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

var serialize = function(obj) {
    var str = [];
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj(p)));
        }
    }
    return str.join("&");
};

var LOWERCASE_ALPHABET = "abcdefghijklmnopqrstuvwxyz";


function WikipediaClient() {
    var QUERY_MAX = 500;  // Maximum results for regular user per individual query, as specified by Wikipedia.
    var THUMBNAIL_QUERY_MAX = 50;
    var WP_ENDPOINT = 'http://en.wikipedia.org/w/api.php?';
    var WP_MAIN_NAMESPACE = 0;
    var filter = new ObscenityFilter();

    function query(request, onSuccess, onFailure) {
        request.action = 'query';
        request.format = 'json';
        $.ajax({
            method: 'GET',
            dataType: "jsonp",
            url: WP_ENDPOINT,
            data: request,
            success: function(response) {
                if (response.hasOwnProperty('warnings'))
                    console.log(response.warnings);
                if (!response.hasOwnProperty('error') && response.hasOwnProperty('query')) {
                    onSuccess(response.query);
                } else {
                    var error = {
                        name: "query error",
                        message: "Failed to retrieve pages!",
                        category: request.gcmtitle,
                    };
                    onFailure(error);
                }
            }
        });
    }


    this.generateQuestion = function(category, onSuccess, onFailure) {
        var question = {};
        question.choices = [];
        question.thumbnail = new Image();
        question.answerKey = "";

        var response_1;
        var pages_1;
        var keys_1;

        //Second request may be necessary if first
        //does not provide enough information.
        var response_2;
        var pages_2;
        var keys_2;

        var request = { prop: 'pageimages|info', 
                        inprop: 'url', 
                        piprop: 'original', 
                        pilimit: THUMBNAIL_QUERY_MAX, 
                        gcmlimit: QUERY_MAX, 
                        generator: 'categorymembers', 
                        gcmprop: 'ids', 
                        gcmnamespace: WP_MAIN_NAMESPACE, 
                        gcmsort: 'sortkey',
                        gcmtitle: category
        };

        prepareFirstQuery();
        query(request, handleFirstQuery, onFailure);


        function prepareFirstQuery() {
            //Randomly generate a starting character from which
            //  to collect Wikipedia page results.
            //  If character is in first half of alphabet,
            //      collect results going up the alphabet
            //  else, collect results going down the alphabet.
            //
            //  (This behavior is necessary since Wikimedia API
            //   does not wrap results around the alphabet.)
            var startingLetterIndex = getRandomInt(25, 0);
            if (startingLetterIndex <= 12)
                request.gcmdir = 'asc';
            else
                request.gcmdir = 'desc';
            var startingLetter = LOWERCASE_ALPHABET.charAt(startingLetterIndex);
            request.gcmstartsortkeyprefix = startingLetter;
        }


        function prepareSecondQuery() {
            // Search again from the same starting letter in the opposite direction.
            //      This ensures entire alphabet is fairly checked.
            if (request.gcmdir == 'asc')
                request.gcmdir = 'desc';
            else
                request.gcmdir = 'asc';
        }


        function handleFirstQuery(response) {
            response_1 = response;

            pages_1 = response_1.pages;
            keys_1 = Object.keys(pages_1);
            keys_1 = shuffle(keys_1);
            searchForAnswer(pages_1, keys_1);

            if (question.thumbnail.src && keys_1.length >= 5) {
                assembleQuestion();
                onSuccess(question);
            } else {
                // If a thumbnail hasn't been found among the first 500 pages, give up.
                if (!question.thumbnail.src && keys_1.length >= 500) {
                    var error = { 
                        name: "handleFirstQuery error",
                        error: "Could not find thumbnail images for this category.",
                        category: category
                    };
                    onFailure(error);
                } else {
                    prepareSecondQuery();
                    query(request, handleSecondQuery, onFailure);
                }
            }
        }

        function handleSecondQuery(response) {
            response_2 = response;

            pages_2 = response_2.pages;
            keys_2 = Object.keys(pages_2);
            keys_2 = shuffle(keys_2);
            searchForAnswer(pages_2, keys_2);

            if (question.thumbnail.src) {
                assembleQuestion();
                onSuccess(question);              
            } else {
                // If a suitable answer still can't be found,
                //      then one probably does not exist.
                //      (By this point, either the entire category
                //      has been searched or at least 1000 of its pages.)
                var error = { 
                    name: "handleSecondQuery error",
                    error: "Could not find thumbnail images for this category." ,
                    category: category
                };
                onFailure(error);  
            }

        }

        // A suitable answer article must contain a thumbnail image.
        //      If a suitable article is found, collect its 
        //      information and add it to the choices array.
        function searchForAnswer(pages, keys) {
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var page = pages[key];
                if (page.hasOwnProperty('thumbnail')) {
                    if (filter.containsObscenity(pages[key].title)) {
                        console.log("Title: '" + pages[key].title + "' rejected due to possible innappropriate content.");
                        continue;
                    }

                    //preload image immediately
                    question.thumbnail.src = pages[key].thumbnail.original;
                    question.answerKey = key;

                    var correctChoice = {};
                    correctChoice.title = pages[key].title;
                    correctChoice.url = pages[key].fullurl;
                    correctChoice.key = key;
                    question.choices.push(correctChoice);
                    break;
                }
            }
        }

        function assembleQuestion() {
            var choiceCount = 1;
            for (var i = 0; i < keys_1.length && choiceCount < 5; i++) {
                var key = keys_1[i];
                if (key === question.answerKey) {
                    continue;
                }
                var title = pages_1[key].title;
                if (filter.containsObscenity(title)) {
                    console.log("Title: '" + title + "' rejected due to possible innappropriate content.");
                    continue;
                }

                var url = pages_1[key].url;
                question.choices.push({ title: title,
                                        url: url,
                                        key: key});
                choiceCount++;
            }

            // If there are not enough articles from the first query, 
            //      then a second query must have been made,
            //      If this is the case, 
            //          use articles from the second query. 
            if (choiceCount < 5) {
                for (var i = 0; i < keys_2.length && choiceCount < 5; i++) {
                    var key = keys_2[i];
                    if (key === question.answerKey) {
                        continue;
                    }
                    var title = pages_2[key]['title'];
                    if (filter.containsObscenity(title)) {
                        console.log("Title: '" + title + "' rejected due to possible innappropriate content.");
                        continue;
                    }
                    var url = pages_2[key]['url'];                
                    question.choices.push({ title: title,
                                            url: url,
                                            key: key});
                    choiceCount++;
                }                
            }

            question.choices = shuffle(question.choices);
        }

    };

}

function WikipediaGame() {
    var wikiClient = new WikipediaClient();

    var CATEGORY = 'Category:California_counties'; //TODO: NO LONGER HARDCODE THIS
    // var category = 'Category:1955_deaths'; //TODO: NO LONGER HARDCODE THIS

    var gameSetup = false;
    var MAX_TURNS = 10;

    var turnCount;
    var correctCount;
    var wrongCount;

    var imageQueue;
    var questionQueue;
    var failingCategories;

    var questionsLoaded;
    var questionLoadFailures;
    var nextQuestionBlocked;

    var curQuestion;
    var nextQuestion;
    var nextImage;

    var submitButton = $('#submitButton');
    var nextQuestionButton = $('#nextQuestionButton');
    var newGameButton = $('#newGameButton');
    var choiceDiv = $('.question-square .choice-section');
    var thumbnail = $('#thumbnail');

    var self = this;

    this.newGame = function() {
        console.log('Starting new game');
        newGameButton.hide();
        submitButton.hide();

        turnCount = 0;
        correctCount = 0;
        wrongCount = 0;

        imageQueue = [];
        questionQueue = [];
        failingCategories = [];

        questionsLoaded = 0;
        questionLoadFailures = 0;
        nextQuestionBlocked = true;
        nextImage = new Image();

        $('#correct').text(correctCount);
        $('#wrong').text(correctCount);

        loadQuestions(MAX_TURNS);
        if (!gameSetup) {
            setupGame();
            gameSetup = true;
        } else {
            curQuestion = nextQuestion;
        }
        $('input[name=wikichoice]').attr('checked', false);

    };

    function loadQuestions(loadCount) {
        for (var i = 0; i < loadCount; i++) {
            var question = wikiClient.generateQuestion(CATEGORY, onSuccess, onFailure);
        }

        function onSuccess(question) {
            var img = new Image();
            img.onload = function() {
                questionsLoaded++;
                console.log("Question " + questionsLoaded + " loaded.");

                imageQueue.push(img);
                questionQueue.push(question);
                
                // If first question hasn't been shown yet.
                if (turnCount == 0) {
                    nextQuestion = questionQueue.shift();
                    nextImage = imageQueue.shift();
                    advanceTurn();
                } else if (nextQuestionBlocked) {
                    nextQuestionButton.prop('disabled', false);
                    nextQuestionBlocked = false;
                }
            };
            img.onerror = function() {
                // TODO
            }

            img.src = question.thumbnail.src;
        }

        function onFailure(error) {
            console.log("Question NOT received from category: " + error.category);
            console.log(error.message);
            failingCategories.push(error.category);

            questionLoadFailures++;
            if (questionLoadFailures < 10) {
                loadQuestions(1);
            } else {
                console.log("Too many questions are failing to load.  Try reloading game.");
            }
        }

    }

    function setupGame() {
        console.log('Setting handlers');

        submitButton.click(function(event) {
            console.log('Submit Button clicked');
            var choiceId = $("input[name=wikichoice]:checked").val();
            if (choiceId === undefined) {
                return;
            }
            submitButton.hide();
            checkAnswers(choiceId);

            if (turnCount >= MAX_TURNS) {
                newGameButton.show();
            } else {
                // If no more questions have loaded yet,
                //      prevent the user from proceding
                //      by disabling the "Next Question" button.
                if (imageQueue.length < 1) {
                    nextQuestionButton.prop('disabled', true);
                    nextQuestionBlocked = true;
                } else {
                    nextQuestion = questionQueue.shift();
                    nextImage = imageQueue.shift();
                }
                nextQuestionButton.show();
            }

        });

        nextQuestionButton.click(function(event) {
            console.log('Submit Button clicked');
            nextQuestionButton.hide();
            advanceTurn();
        });

        newGameButton.click(function(event) {
            self.newGame();
        });

    }


    function advanceTurn() {
        setNextQuestion();
        curQuestion = nextQuestion;
        submitButton.show();
        turnCount++;
        console.log("Question " + turnCount);
    }


    function setNextQuestion() {
        choiceDiv.css('visibility', 'hidden');
        thumbnail.css('visibility', 'hidden');

        console.log('Setting next question');
        thumbnail.attr('src', nextImage.src);
            
        console.log('Setting question visible.');
        choiceDiv.css('visibility', 'visible');
        thumbnail.css('visibility', 'visible');

        $('#questionHeader').text('Question ' + turnCount);

        $('.choice-section').children().each(function(index) {
            var choice = $(this);
            var label = choice.find('label');
            label.removeClass('correct');
            label.removeClass('incorrect');
            label.text(nextQuestion.choices[index].title);

            var anchor = choice.find('a');
            anchor.hide();
            anchor.attr("href", nextQuestion.choices[index].url);

            var input = choice.find('input');
            input.attr("value", nextQuestion.choices[index].key);
        });

        $('input[name=wikichoice]').attr('checked', false);
    }

    function checkAnswers(guess) {
        console.log('Showing answer');
        $('.choice-section a').each(function(index) {
            $(this).show();
        });
        var answerKey = curQuestion.answerKey;

        if (guess == answerKey) {
            correctCount = correctCount + 1;
            $('#correct').text(correctCount);
        } else {
            wrongCount = wrongCount + 1;
            $('#wrong').text(wrongCount);
        }

        $('.choice-section').children().each(function(index) {
            var choice = $(this);
            var input = choice.find('input');

            if (input.val() == answerKey) {
                choice.find('label').addClass('correct');
            } else if (input.val() == guess) {
                choice.find('label').addClass('incorrect');
            }
        });
    }

}

$(document).ready(function() {
    // var wikipediaGame = new WikipediaGame();
    // wikipediaGame.newGame();
    var wikiClient = new WikipediaClient();
    var wikiGame = new WikipediaGame();
    wikiGame.newGame();

    // wikiClient.generateQuestion('Category:1955_deaths', function(question) {
    //     console.log(question);
    // });
});

