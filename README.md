# leg_bot is no more, long unlive the "ghost_of_leg_bot"

Originally written by Ufokraana, updated and currently hosted by Anaerin (anaerin@gmail.com)

ghost_of_leg_bot is a twitch chat bot for the Loading Ready Run Fan Streamer Community.

* ghost_of_leg_bot keeps track of any relevant stats (like `!death` or `!warcrime`) that the streamer wants kept track of.
* ghost_of_leg_bot gives "useful" `!advice`. This advice is shared between channels to make sure that one streamers troubles with punching robots can help another win a MTGO draft.
* ghost_of_leg_bot gives information about when the next LRR or fan stream starts (`!nextlrr` and `!nextfan`)

## Help

* `!help` makes ghost_of_leg_bot give you a link to the article about this bot on my blog. I am trying to keep that link as up-to-date as I can.

## Calendar

* `!nextlrr` Tells you of any current and upcoming LRR streams.
* `!nextfan` Ditto for fan streams

Both of these commands can be followed with a timezone in the Continent/City format.

Other calendars can be specified - the details on how to do so are in config.js

## Game

Many of ghost_of_leg_bot functions depend on it knowing what game is currently being played. This is regularly queried from the Twitch API, but channel moderators can override it. Ghost_of_leg_bot retrieves twith API data every 90 seconds.

* `!game` Shows what game ghost_of_leg_bot thinks is being played.
* `!game override <X>` Forces ghost_of_leg_bot to use X as the current game value. If you leave out X or set it to "off", ghost_of_leg_bot will revert to using the value given by Twitch.

## Statistics

The statistics system for ghost_of_leg_bot should be familiar to anyone who has used lrrbot or seen it in action.

* `!stats` gives you a list of statistics that ghost_of_leg_bot counts for the current channel. Use one of these instead of `<stat>` for the following commands.
* `!<stat>` increases the given stat by one.
* `!total<stat>` gives you a total count of the given statistic across all games.
* `!<stat>count` gives you a count of the given stat for the current game

You can also access statistics through the web interface (https://ghostoflegbot.tk/stats)

### Mod-only commands

* `!<stat> add <X>` and `!<stat> remove <X>` adds or removes a given amount from the statistic for the current game. X defaults to 1 when not given.
* `!<stat> set <X>` sets the value of the given statistic for the current game.

Statistics can also be added or removed by moderators.

* `!counter add example "instance of demonstration" "instances of demonstration"` adds a statistic called "example", with appropriate singular and plural descriptions.

It would appear like:

```
<user> !example
<ghost_of_leg_bot> 1 instance of demonstration
```
* `!counter remove example` Would remove the statistic added above.

## Advice

* `!advice` Makes ghost_of_leg_bot give an "useful" bit of advice.
* `!advice source` Shows information about the last given bit of advice: What channel is it from, what game was being played, and who added it.
* `!advice count` Shows you the ammount of advice that ghost_of_leg_bot knows.
* `!advice add <X>` This allows channel moderators to add X as a new advice. Note, that since advices are tied to games, you'll need to use !game override to set a game when adding advices when a stream isn't live. Also, to avoid any tomfoolery, a piece of advice cannot start with any nonalphanumeric characters.
* `!advice vote` This gives a link to https://ghostoflegbot.tk/advice , where you can upvote or downvote the submitted advice. Any advice that gets 0 votes will be removed from the rotation.

## Joining

Joining ghost_of_leg_bot's channel and saying `!join` (or whispering `!join` to it) will ask it to join your channel. Similarly, saying `!part` in ghost_of_leg_bot's channel (or whispering `!part`) will ask it to leave. And saying `!follow` (in both instances) will have it follow you, and show your channel in both its live report (`!live`) and on its live page (https://ghostoflegbot.tk/live).

Also, if you are on the fanstreamer calendar, and you're not already, ghost_of_leg_bot will automatically follow you when you appear in the schedule.

## Barks

Named after the random "Flavour" announcements that NPCs make in games, Barks allow you to set up short phrases that can be triggered by keyword, or set at an interval.

* `!bark add <keyword> "<message>" <Mod Only flag (true or false)> [optional interval to repeat, in minutes]`

So, for instance:

> `!bark add modonly "This is only triggerable by mods" true`

Would add a new bark (`!modonly`) that can only be triggered by mods or the streamer.

> `!bark add anybody "This can be triggered by anybody" false`

Would add a new bark (`!anybody`) that can be triggered by anyone.

> `!bark add motd "A message of the day, for instance" false 60`

Would add a new bark (`!motd`) that will be automatically triggered every hour.

* `!bark remove <keyword>` Will remove the previously set-up bark.
* `!barks` will list all current barks for the channel.

## Dice rolling

Yes, dice rolling is included too. Use regular D&D-style roll descriptions:

* `!roll 2d20+5` would return something like "Rolled 2d10+5 and got 25 (1,19)" - The number in brackets is the list of the die rolled, before + modifiers.

## Seen tracking

Ghost_of_leg_bot also now tracks where people last spoke (or whispered, or streamed). So, for example:

* `!seen anaerin` would return something like "Last saw anaerin 16 minutes ago, in their own channel" or "Last saw anaerin 5 minutes ago, streaming", or "Last saw anaerin 19 hours ago, in keab42's room"

## Quotes

Yes, quoting is enabled too (Disabled for cantwearhats and hpbraincase, as they have their own bots that handle quotes).

* `!quote` gives a random quote
* `!quote count` returns the number of quotes available
* `!quote <number>` returns quote number
* `!quote bytext <search term>` searches for and returns a random quote with the text "search term" in it
* `!quote byauthor <author>` searches for a random quote by author
* `!quote bygame <game>` searches for a random quote said during game
* `!quote bychannel <channel>` searches for a random quote said in channel
* `!quote bydate <date>` searches for a random quote said on date
* `!quote <search term>` Will attempt an intelligent search, checking quote, author, channel, date and game for the term specified.

### Mod-only commands

* `!quote add <quote> (author) [date]` If author is not specified, author will be assumed to be person logging the quote, if date is not specified, it's assumed to be now.
For example:

* `!quote add This is how quotes work (Anaerin) [2016-03-11]`
* `!quote add This will be logged as being from whoever posted it [2016-05-23]`
* `!quote add And this one will be logged as whoever posted it, when it was posted.`
* `!quote mod <id> <quote> (author) [date]` Modifies quote # ID. Author and date are optional, if they're not specified, they're not changed.
* `!quote del <id>` Removes quote #id

## Web API

For those of you with an overlay, there are several ways you can interact with ghost_of_leg_bot via a web API.

### HTTPS queries
* Statistic counters can be fetched from the API at: `https://ghostoflegbot.tk/api/channel/<channel name>/stat/<statistic name>`. They return the raw number. So if Anaerin wanted to fetch the number of deaths (provided he has that stat set up), he could include `https://ghostoflegbot.tk/api/channel/anaerin/stat/deaths`
* Barks can be triggered from the Web API: `https://ghostoflegbot.tk/api/channel/<channel name>/barks/<bark name>`, so if Anaerin wanted to trigger the bark "endscreen" he could open `https://ghostoflegbot.tk/api/channel/anaerin/barks/endscreen` in a browser source on his end-screen (for example)

### WebSockets

The API also supports WebSockets. To access the websocket feed, connect a websocket to `ws://ghostoflegbot.tk/ws/<channel>`, and you will get notifications when statistics (and the current game) changes. For example:
```
{action: 'GameChanged', game: 'Creative'}
{action: 'StatChanged', stat: 'death', value: 20}
```

## Misc

* `!live` makes ghost_of_leg_bot give you a list of awesome channels that are live at the moment.
* `!calendar` makes ghost_of_leg_bot give you a link to the fan streamer calendar http://bit.ly/LRRFanStreamCalendar2
* `!lrr` makes ghost_of_leg_bot throw a link to http://www.loadingreadyrun.com to the channel.
* `!fancrossing` makes ghost_of_leg_bot throw a link to the survivor_tv fan crossing spreadsheet.

I have tried to add as many channels of the LRR fan stream community to the !live command as I could find. It will add any streams it finds in the calendar too, but if I am missing any, let me know.
