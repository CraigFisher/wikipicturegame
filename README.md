# wikipicturegame
(note: game logic may be found in wikipicturegame/game/static/game/wikipediagame.js)

A Django and JavaScript-based app to "guess which Wikipedia page this image appears on".  You can find the app online here: http://wikipicturegame.herokuapp.com.  Images and links are accessed via the Wikipedia API: http://www.mediawiki.org/wiki/API:Main_page.

To run the project, make sure to set up a virtualenv using my requirements.txt file.  You will need to set the following environmental variables:

WIKIPICTUREGAME_DB_USER,

WIKIPICTUREGAME_SECRET_KEY,

WIKIPICTUREGAME_DATABASE_URL (must include db password)

WIKIPICTUREGAME_DEBUG (If set to 'True', app will be run in debug mode.)
