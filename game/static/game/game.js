"use strict"




// function WikipediaGame() {
//     var turnCount;
//     var correctCount;
//     var curQuestion;
//     var handlersSet = false;
//     var category;

//     this.initGame = function() {
//         turnCount = 0;
//         correctCount = 0;
//         if (!callbacksSet) {
//             handlersSet();
//         }
//     }

//     function setHandlers() {
//         var submitButton = $('#submitButton');
//         var nextQuestionButton = $('#nextQuestionButton');
//         var questionHeader = $('#questionHeader')

//         submitButton.click(function(event) {
//             submitButton.hide();
//             nextQuestionButton.css('visibility', 'hidden');
//             nextQuestionButton.show();
//             showAnswer();
//             getNextQuestion();
//             nextQuestionButton.css('visibility', 'visible');

//         });

//         nextQuestionButton.click(function(event) {
//             nextQuestionButton.hide();
//             submitButton.show();
//             turnCount += 1;
//             questionHeader.text('Question ' + turnCount);
//             setQuestionChoices();
//         });

//     };

//     function getNextQuestion() {
//         $.ajax({
//             datatype: 'json',
//             contentType: 'application/json',
//             data: JSON.stringify(data),
//             type: 'GET',
//             success: function(result) {
//                 curQuestion = result;
//             },
//         });
//     };

//     function setQuestionChoices() {
//         $('.choice-section label').each(function(index) {
//             var item = $(this);
//             item.removeClass('correct');
//             item.removeClass('incorrect')
//             item.text(question.title)
//         });

//         $('.choice-section a').each(function(index) {
//             $(this).hide();
//             $(this).attr("href", question.choices[index]);
//             $(this).attr("key")
//         });

//         $('input[name=wikichoice]').attr('checked', false);
        
//         SET NEW CHOICE KEY VALUE

//     };

//     function showAnswer() {
//         var choiceId = $("input[name=wikichoice]:checked").val();

//         UN-HIDE URLS

//         APPLY CORRECT CSS CLASS
//             APPLY INCORRECT CSS CLASS IF NECESSARY

//     };


// };



$(document).ready(function() {
    $('input[name=wikichoice]').attr('checked', false);

});

