"use strict"


function WikipediaGame() {
    var turnCount;
    var correctCount;
    var wrongCount;

    var curQuestion;
    var nextQuestion;
    var nextImage = new Image();

    var gameSetup = false;
    var category = 'Category:California_counties'; //TODO: NO LONGER HARDCODE THIS
    var MAX_TURNS = 10;

    var submitButton = $('#submitButton');
    var nextQuestionButton = $('#nextQuestionButton');
    var newGameButton = $('#newGameButton');

    var choiceDiv = $('.question-square .choice-section');
    var thumbnail = $('#thumbnail');

    var that = this;

    this.newGame = function() {
        console.log('Starting new game');
        newGameButton.hide();
        submitButton.show();

        setFirstQuestion();
        turnCount = 1;
        correctCount = 0;
        wrongCount = 0;
        $('#correct').text(correctCount);
        $('#wrong').text(correctCount);
        if (!gameSetup) {
            setupGame();
            gameSetup = true;
        }
        $('input[name=wikichoice]').attr('checked', false);

    };

    function setupGame() {
        console.log('Setting handlers');

        submitButton.click(function(event) {
            console.log('Submit Button clicked');
            var choiceId = $("input[name=wikichoice]:checked").val();
            if (choiceId === undefined) {
                return;
            }
            submitButton.hide();
            nextQuestionButton.css('visibility', 'hidden');
            nextQuestionButton.show();

            checkAnswers(choiceId);
            getNextQuestion();
            nextQuestionButton.css('visibility', 'visible');

            if (turnCount >= MAX_TURNS) {
                nextQuestionButton.hide();
                newGameButton.show();
                console.log('adfsad');
                newGameButton.click(function(event) {
                    that.newGame();
                });
            }
        });

        nextQuestionButton.click(function(event) {
            console.log('Submit Button clicked');
            curQuestion = nextQuestion;
            nextQuestionButton.hide();
            submitButton.show();
            
            turnCount += 1;
            setNextQuestion();
        });

    };

    function setFirstQuestion() {
        getNextQuestion(true);
    };

    function getNextQuestion(setImmediately) {
        console.log('Retrieving next question');
        var data = {'category': category};
        $.ajax({
            datatype: 'json',
            contentType: 'application/json',
            data: JSON.stringify(data),
            type: 'POST',
            success: function(result) {
                nextQuestion = result;
                console.log('...question retrieved.');

                //preload image
                nextImage.src = nextQuestion['thumbnail'];
                if (setImmediately) {
                    curQuestion = nextQuestion;
                    setNextQuestion();
                }
            },
            error: function () {
                console.log('...AJAX ERROR.');
            }
        });
    };

    function setNextQuestion() {
        choiceDiv.css('visibility', 'hidden');
        thumbnail.css('visibility', 'hidden');

        console.log('Setting next question');
        thumbnail.attr('src', nextImage.src);
        thumbnail.load(function() {
            choiceDiv.css('visibility', 'visible');
            thumbnail.css('visibility', 'visible');            
        });

        $('#questionHeader').text('Question ' + turnCount);

        $('.choice-section').children().each(function(index) {
            var choice = $(this);

            var label = choice.find('label');
            label.removeClass('correct');
            label.removeClass('incorrect');
            label.text(curQuestion.choices[index]['title']);

            var anchor = choice.find('a');
            anchor.hide();
            anchor.attr("href", curQuestion.choices[index]['url']);

            var input = choice.find('input');
            input.attr("value", curQuestion.choices[index]['key']);
        });       

        $('input[name=wikichoice]').attr('checked', false);
    };

    function checkAnswers(guess) {
        console.log('Showing answer');
        $('.choice-section a').each(function(index) {
            $(this).show();
        });
        var answerKey = curQuestion['answerKey'];

        if (guess == answerKey) {
            correctCount = correctCount + 1;
            console.log(correctCount);
            $('#correct').text(correctCount);
        } else {
            wrongCount = wrongCount + 1;
            console.log(wrongCount);
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

    };


};

$(document).ready(function() {
    var wikipediaGame = new WikipediaGame();
    wikipediaGame.newGame();
});

