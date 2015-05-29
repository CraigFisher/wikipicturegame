"use strict";

var getRandomInt = function(min, max) { // Inclusive /
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


function CategoryLoader(useDatabase) {
    var MAX_CATEGORY_REQUESTS = 50; // No more than 50 categories could even be used
                                    // in a standard game of 10 turns 5 questions each.
                                    // Excessive requests should be ignored.
    this.useDatabase = useDatabase;
    if (PRE_LOADED_CATEGORIES)
        var remainingPreloadedCategories = PRE_LOADED_CATEGORIES.length;
    else 
        var remainingPreloadedCategories = 0;


    this.requestCategories = function(requestAmount, onSuccess, onFailure) {
        var categories = [];
        if (requestAmount > MAX_CATEGORY_REQUESTS) {
            var error = {
                name: "requestCategories error",
                message: "Too many categories requested!  Limit is " + MAX_CATEGORY_REQUEST,
            };
            onFailure(error);
            return;
        }
        // If not using the database, just keep recycling the preloaded categories. 
        if (!useDatabase) {
            if (requestAmount > PRE_LOADED_CATEGORIES.length) {
                var error = {
                    name: "requestCategories error",
                    message: "Insufficient categories to meet request.",
                };
                onFailure(error);
                return;
            }
            categories = PRE_LOADED_CATEGORIES.slice(0, requestAmount);
            onSuccess(categories);
        // Otherwise, use preloaded categories first until they've all been used.
        } else {
            if (remainingPreloadedCategories) {
                for (var i = 0; i < requestAmount && remainingPreloadedCategories; i++) {
                    var nextCategory = PRE_LOADED_CATEGORIES[remainingPreloadedCategories - 1];
                    categories.push(nextCategory);
                    remainingPreloadedCategories--;
                }
            }

            if (categories.length >= requestAmount) {
                onSuccess(categories);
            } else {
                console.log("Retrieving more categories from database");
                // SEND OUT NEW AJAX REQUEST TO DATABASE

                    // SEND REQUEST WITH CALLBACKS onCategoriesSuccess AND ONFAILURE
            }
        }

        function onNewCategoriesLoaded() {
            // PARSE RESULTS FOR ONLY THE TITLES
            // ONSUCCESS(CATEGORIES)
        }

    };

}


function CategoryWrapper(pages, title) {
    this.title  = title;    
    this.pages  = pages;
    this.keys   = Object.keys(pages);
    this.length = this.keys.length;
    this.cursor = 0;
}


CategoryWrapper.prototype.nextPage = function() {
    if (this.cursor === this.length - 1) {
        this.cursor = 0;
    } else {
        this.cursor = this.cursor + 1;
    }
    return this.pages[this.keys[this.cursor]];
};


CategoryWrapper.prototype.shuffle = function() {
    this.keys = shuffle(this.keys);
};


function WikipediaClient() {
    var WP_QUERY_MAX = 500;      // Wikipedia API's maximum number of results per query.
    var CUSTOM_QUERY_MAX = 250;  // Custom limit
    var THUMBNAIL_QUERY_MAX = 50;
    var WP_ENDPOINT = 'http://en.wikipedia.org/w/api.php?';
    var WP_MAIN_NAMESPACE = 0;

    var rememberedCategories = {};
    var previousAnswerKeys = [];
    var filter = new ObscenityFilter();

    this.reset = function() {
        rememberedCategories = {};
        previousAnswerKeys = [];
    };

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
                if (response.hasOwnProperty('error')) {
                   var error = {
                        name: "API error",
                        message: "Failed to retrieve pages!",
                        category: request.gcmtitle,
                    };
                    onFailure(error);
                    return;
                } 
                if (!response.hasOwnProperty('query')) { // If query returned no results, API does not
                    response.query = {};                 //     set a query parameter at all, 
                }                                        //     so explicitly set an empty one
                onSuccess(response.query, request.gcmtitle);
            },
            error: function() {
                var error = {
                    name: "AJAX error",
                    message: "Failed to retrieve pages!",
                    category: request.gcmtitle,
                };
                onFailure(error);
            }
        });
    }


    this.generateQuestion = function(questionCategories, onSuccess, onFailure) {
        var question = {};
        question.choices = [];
        question.thumbnail = new Image();
        question.answerKey = "";
        question.answerCategory = "";

        var numCategories = questionCategories.length;
        var categoryDictionary = {};
        var numRequestsReceived = 0;
        var onFailureSent = false;

        for (var i = 0; i < numCategories; i++) {
            var categoryTitle = questionCategories[i];
            // If category's members have already been collected 
            //      from a previous question, recycle them.
            if (rememberedCategories.hasOwnProperty(categoryTitle)) {
                categoryDictionary[categoryTitle] = rememberedCategories[categoryTitle];
                numRequestsReceived++;
                if (numRequestsReceived === numCategories) {
                    assembleQuestion();
                }
            } else {
                queryCategoryMembers(questionCategories[i]);
            }
        }

        // Send out two requests: one ascending the alphabet from a chosen letter, 
        //      the other descending the alphabet.
        // (This behavior is necessary since Wikimedia API
        //  does not wrap results around the alphabet.)
        function queryCategoryMembers(category) {
            var request = { 
                prop: 'pageimages|info', 
                inprop: 'url', 
                piprop: 'original', 
                pilimit: THUMBNAIL_QUERY_MAX,
                gcmlimit: CUSTOM_QUERY_MAX,
                generator: 'categorymembers', 
                gcmprop: 'ids', 
                gcmnamespace: WP_MAIN_NAMESPACE, 
                gcmsort: 'sortkey',
                gcmtitle: category,
            };

            // Randomly generate a starting character from which
            // to collect Wikipedia page results.
            var startingLetterIndex = getRandomInt(0, 26);
            var startLetter = LOWERCASE_ALPHABET.charAt(startingLetterIndex);
            request.gcmstartsortkeyprefix = startLetter;

            // Deep copy request
            var request2 = JSON.parse(JSON.stringify(request));
            request.gcmdir  = 'asc';
            request2.gcmdir = 'desc';

            query(request,  combineRequests, onCategoryMembersFailure);
            query(request2, combineRequests, onCategoryMembersFailure);

            var response_1;
            var response_2;
            var combinedResponse = {};
            var numReceived = 0;

            function combineRequests(response, category) {
                if (onFailureSent)
                    return;
                numReceived++;
                if (numReceived === 1) {
                    response_1 = response;
                } else {
                    response_2 = response;
                    $.extend(response_1, response_2);
                    onCategoryMembersSuccess(response_1, category);
                }
            }
        }

        function onCategoryMembersSuccess(response, category) {
            if (onFailureSent)
                return;
            numRequestsReceived++;
            rememberedCategories[category] = new CategoryWrapper(response.pages, category);
            categoryDictionary[category] = rememberedCategories[category];
            if (numRequestsReceived === numCategories) {
                assembleQuestion();
            }
        }

        function onCategoryMembersFailure(error) {
            if (onFailureSent)
                return;
            onFailure(error);
            onFailureSent = true;
        }

        function assembleQuestion() {
            // Freshly shuffle all the categories before digging
            //      them for questions.
            for (var i = 0; i < numCategories; i++) {
                var curCategory = categoryDictionary[questionCategories[i]];
                curCategory.shuffle();
            }

            for (var i = 0; i < numCategories; i++) {
                var curCategory = categoryDictionary[questionCategories[i]];
                if(searchForValidAnswer(curCategory)) {
                    break;
                }
            }
            // If valid answer not found, return with onFailure
            if (!question.thumbnail.src) {
                var error = { 
                    name: "assembleQuestion error",
                    error: "Could not find valid images from these categories."
                };
                onFailure(error);
                return;
            }

            var choiceCount = 1;
            while (choiceCount < 5) {
                var curCategoryTitle = questionCategories[choiceCount % numCategories];
                var curCategory = categoryDictionary[curCategoryTitle];

                var choice;
                for (var i = 0; i < curCategory.length; i++) {
                    var page = curCategory.nextPage();
                    if (page.pageid === question.answerKey) {
                        continue;
                    }
                    if (filter.containsObscenity(page.title)) {
                        console.log("Title: '" + page.title + "' rejected due to possible innappropriate content.");
                        continue;
                    }
                    choice = {
                        title: page.title,
                        url: page.fullurl,
                        key: page.pageid,
                        category: curCategory.title
                    };
                    // If even one category fails to produce any choices,
                    //      call onFailure with error.
                    if (!choice) {
                        var error = { 
                            name: "assembleQuestion error",
                            error: "Category did not yield any valid choices.",
                            category: curCategory.title
                        };
                        onFailure(error);                            
                        return;
                    }
                    question.choices.push(choice);
                    break;
                }
                choiceCount++;                        
            }
            question.choices = shuffle(question.choices);
            onSuccess(question);
        }

        // A suitable answer article must contain a thumbnail image.
        //      If a suitable article is found, collect its 
        //      information and add it to the choices array.
        function searchForValidAnswer(category) {
            for (var i = 0; i < category.length; i++) {
                var page = category.nextPage();
                if (page.hasOwnProperty('thumbnail')) {
                    // Make sure we didn't already use answer.
                    if (previousAnswerKeys.indexOf(page.pageid) > -1) {
                        continue;
                    }
                    if (filter.containsObscenity(page.title)) {
                        console.log("Title: '" + page.title + "' rejected due to possible innappropriate content.");
                        continue;
                    }
                    previousAnswerKeys.push(page.pageid);

                    //preload image immediately
                    question.thumbnail.src = page.thumbnail.original;
                    question.answerKey = page.pageid;
                    question.answerCategory = category.title;

                    var answerChoice = {
                        title: page.title,
                        url: page.fullurl,
                        key: page.pageid,
                        category: category.title
                    };
                    question.choices.push(answerChoice);
                    return true;
                }
            }
            return false;
        }
 
    };

}


function WikipediaGame() {
    var MAX_TURNS = 10;
    var CATEGORIES_PER_GAME = 3;        //TODO: make flexible       
    var CATEGORIES_PER_QUESTION = 3;    //TODO: make flexible
    var USE_DATABASE = false;           

    var wikiClient = new WikipediaClient();
    var categoryLoader = new CategoryLoader(USE_DATABASE);
    var buttonHandlersSet = false;

    var turnCount;
    var correctCount;
    var wrongCount;

    var imageQueue;
    var questionQueue;
    var gameCategories;

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
        gameCategories = [];

        questionsLoaded = 0;
        questionLoadFailures = 0;
        nextQuestionBlocked = true;
        nextImage = new Image();

        $('#correct').text(correctCount);
        $('#wrong').text(correctCount);

        wikiClient.reset();
        loadNewGameData();

        if (!buttonHandlersSet) {
            setupButtonHandlers();
            buttonHandlersSet = true;
        } else {
            curQuestion = nextQuestion;
        }
        $('input[name=wikichoice]').attr('checked', false);

    };

    function loadNewGameData() {
        categoryLoader.requestCategories(CATEGORIES_PER_GAME, 
                                         onCategoriesLoaded,
                                         onCategoriesFailed);

        function onCategoriesLoaded(categoriesReceived) {
            gameCategories = categoriesReceived;
            loadQuestions(MAX_TURNS);
        }

        function onCategoriesFailed(error) {
            console.log(error.name + ", Question NOT received: ");
            console.log(error.message);

            alert("Cannot generate game categories right now.  " + 
                  "Try reloading or coming back later.");
        }

        function loadQuestions(loadCount) {
            for (var i = 0; i < loadCount; i++) {
                // Shuffle categories and pick first set
                gameCategories = shuffle(gameCategories);
                var questionCategories = gameCategories.slice(0, CATEGORIES_PER_QUESTION);
                wikiClient.generateQuestion(questionCategories, onSuccess, onFailure);
            }

            function onSuccess(question) {
                var img = new Image();
                img.onload = function() {
                    questionsLoaded++;
                    console.log("Question " + questionsLoaded + " loaded.");

                    imageQueue.push(img);
                    questionQueue.push(question);
                    
                    // If first question hasn't been shown yet.
                    if (turnCount === 0) {
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
                };

                img.src = question.thumbnail.src;
            }

            function onFailure(error) {
                console.log(error.name + ", Question NOT received: ");
                console.log(error.message);

                if (error.category) {
                    // TODO: DROP CATEGORY FROM AVAILABLE CATEGORY LIST
                }

                questionLoadFailures++;
                if (questionLoadFailures < 10) {
                    loadQuestions(1);
                } else {
                    console.log("Too many questions are failing to load.  Try reloading game.");
                }
            }

        }

    }

    function setupButtonHandlers() {
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

function debugObject(object) {
    $('body').append("<div style='text-align: left'><pre>" + 
                     JSON.stringify(object, null, 2) + 
                     "</pre></div>");
}


$(document).ready(function() {
    var wikiGame = new WikipediaGame();
    wikiGame.newGame();

    // TEST WIKI CLIENT
    // var wikiClient = new WikipediaClient();
    // wikiClient.generateQuestion(
    //         ['Category:1955_deaths', 
    //          'Category:California_counties', 
    //          'Category:Basic_concepts_in_infinite_set_theory'], 
    //         debugObject, 
    //         debugObject
    // );

    // TEST CATEGORY LOADER
    // var categoryLoader = new CategoryLoader(true);
    // categoryLoader.requestCategories(10, debugObject, debugObject);
    // categoryLoader.requestCategories(3, debugObject, debugObject);

    // var categoryLoader = new CategoryLoader(false);
    // categoryLoader.requestCategories(10, debugObject, debugObject);
    // categoryLoader.requestCategories(3, debugObject, debugObject);
});

