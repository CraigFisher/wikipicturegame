from django.core.management.base import BaseCommand
from game.models import WikipediaCategory, RowCounts
from game.utils import containsObscenity
from game.wikipediaclient import query, WP_CATEGORY_NAMESPACE, WP_MAIN_NAMESPACE, WP_THUMBNAIL_QUERY_MAX, WP_QUERY_MAX
from optparse import make_option
from django.db.models import Max
import random
import string


MAX_ROW_COUNT = 7000  # Heroku will begin to complain beyond this point.
DEBUG = True

# Number of thumbnail images and pages necessary
#   for a single category to fill an entire game
#   without either duplicate answers or choices.
MINIMUM_THUMBNAILS_PER_CATEGORY = 10
MINIMUM_PAGES_PER_CATEGORY = 50


class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('-s', '--size',
                    action='store',
                    dest='size',
                    type='int',
                    default=1,
                    help='Specify number of categories to attempt to load.'
                         'Default is 1.'),
        )
    help = 'Attempts to load more categories into the database from the Wikipedia API'

    def handle(self, *args, **options):
        # Make sure max row count has not been exceeded
        tablename = WikipediaCategory._meta.db_table
        rowCount = RowCounts.objects.get(tablename=tablename).rowcount
        if (rowCount >= MAX_ROW_COUNT):
            print("Error: {0} rows counted.  {1} currently allowed.  "
                  "Consider updating Heroku plan.")
            return False

        randomCategoryRequest = {
            'list': 'random',
            'rnnamespace': WP_CATEGORY_NAMESPACE,
        }

        attemptsRemaining = options['size']
        while attemptsRemaining > 0:
            if attemptsRemaining > 10:
                randomCategoryRequest['rnlimit'] = 10
            else:
                randomCategoryRequest['rnlimit'] = attemptsRemaining
            for result in query(randomCategoryRequest):
                for category in result['random']:
                    fullTitle = category['title']
                    dbTitle = fullTitle[9:]
                    if self.categoryInDatabase(dbTitle):
                        continue
                    if self.isCategoryValid(fullTitle, dbTitle):
                        self.insertCategory(dbTitle)
            attemptsRemaining -= 10

        self.updateRowCounts()

    def insertCategory(self, dbTitle):
        print("    Inserting: " + dbTitle)
        newCategory = WikipediaCategory(title=dbTitle)
        newCategory.save()

    def categoryInDatabase(self, dbTitle):
        if WikipediaCategory.objects.filter(title=dbTitle).exists():
            return True
        else:
            return False

    def updateRowCounts(self):
        rowCount = WikipediaCategory.objects.count()
        maxId = WikipediaCategory.objects.all().aggregate(Max('id'))['id__max']

        tablename = WikipediaCategory._meta.db_table
        categoryData = RowCounts.objects.get(tablename=tablename)
        categoryData.rowcount = rowCount
        categoryData.max_id = maxId
        categoryData.save()
        print("\nWikipediaCategory table now has: " + str(rowCount) + " categories, Max Id: " + str(maxId))

    def isCategoryValid(self, fullTitle, dbTitle):
        """Sample at most 500 pages from the category.
           If at least 10 thumbnails and 50 articles
           can be found, load category into database."""
        if containsObscenity(dbTitle):
            print(dbTitle + ": FAILED, potential obscenity.")
            return False

        request = {
            'prop': 'pageimages|info',
            'inprop': 'url',
            'piprop': 'original',
            'pilimit': WP_THUMBNAIL_QUERY_MAX,
            'gcmlimit': WP_QUERY_MAX,
            'generator': 'categorymembers',
            'gcmprop': 'ids',
            'gcmnamespace': WP_MAIN_NAMESPACE,
            'gcmsort': 'sortkey',
            'gcmtitle': fullTitle,
        }

        # Perform search from a random starting character
        # (later on, possibly use a biased alphabet)
        startingCharacterIndex = random.randint(0, 25)
        startingCharacter = string.ascii_lowercase[startingCharacterIndex]
        request['gcmstartsortkeyprefix'] = startingCharacter

        # Search the alphabet in both directions from the starting
        # character.  This behavior is necessary since Wikipedia API
        # does not wrap search results around the alphabet.
        request['gcmdir'] = 'asc'
        try:
            pages_1 = next(query(request))['pages']  # Only first result set is used
        except (StopIteration, KeyError):
            pages_1 = {}

        request['gcmdir'] = 'desc'
        try:
            pages_2 = next(query(request))['pages']  # Only first result set is used
        except (StopIteration, KeyError):
            pages_2 = {}

        pages = pages_1.copy()
        pages.update(pages_2)
        pageKeys = list(pages.keys())

        if len(pageKeys) < MINIMUM_PAGES_PER_CATEGORY:
            print(dbTitle + ": FAILED, too few pages.")
            return False

        thumbnailCount = 0
        for key in pageKeys:
            try:
                if containsObscenity(pages[key]['title']):
                    continue
                if pages[key]['thumbnail']['original']:
                    thumbnailCount += 1
                    if thumbnailCount >= MINIMUM_THUMBNAILS_PER_CATEGORY:
                        break
            except KeyError:
                pass

        if thumbnailCount < MINIMUM_THUMBNAILS_PER_CATEGORY:
            print(dbTitle + ": FAILED, too few thumbnails.")
            return False

        if (DEBUG):
            print("{0}: SUCCESS.  Page count: {1}".format(dbTitle, len(pageKeys)))

        return True
