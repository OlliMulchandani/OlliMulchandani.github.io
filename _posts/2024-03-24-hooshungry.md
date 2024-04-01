---
layout: post
title: HoosHungry
---

This project was created by me and three other UVA first-year computer science students in 24 hours for the annual UVA HooHacks hackathon. It was as hectic a 24 hours as it gets, and that time goes by really fast when your only focus and goal is to develop a full-stack application from scratch. 

The github repository is linked [here](https://github.com/TommyW427/hooshungry).

Here is the devpost description of our submission:

![Website screenshot](/assets/images/hooshungry.png)

## Inspiration
After committing to the Hackathon, our team of four decided to meet the Wednesday afternoon preceding the big event. No location was decided nor plan laid out but we knew that we wanted to come up with an idea. Wednesday afternoon comes by, and we're not sure what the plan is. Tommy's at the amphitheater, Billy's in his dorm at Lille-Maupin, Almas is on the corner, and I'm near the AFC. It takes us 30 minutes just to find a spot to eat, eating into our valuable meeting time. What if we could simply ask "Hoo's Hungry?" to swiftly find the most optimal spot to eat?
## What it does
HoosHungry takes all the work of finding a spot to meet away. Simply host a session and invite your friends by sharing the link. As your friends populate on the map, our Dijkstra's-inspired algorithm will determine what the most optimal UVA food spot to meet at is for your unique set of locations. In the image above, you can see the locations of every user who's currently on the test site and the optimal meeting location is seen with the yellow marker.
## How we built it
We utilized JavaScript with React as the framework to create a web application. There is an Embedded Google Maps API to display where everyone is on grounds and what the most optimal location is. A distance calculating API was used to determine distances in time so that our algorithm could make computations. All of this is hosted on the Firebase cloud to sync users with each other. And we can't forget to mention the clever hooshungry.me domain from GoDaddy that this is all hosted on (important to note that both urls, hooshungry.me and hooshungry.us, have been taken down because of the lack of privacy given by the free domain licenses we received for the hackathon--so many spam calls)
## Challenges we ran into
The journey along the way was lovely, but that doesn't mean that we didn't face our fair share of formidable foes (quite an extraordinary amount actually). Understanding a feasible scope was the first big hurdle. There was so much we wanted to accomplish, but we had to be reasonable. We then weaved through several merge conflicts and obscure error messages. We kept chugging along until we found out that we got charged $120 :( for the distance calculating API so we had to pivot from that real quick. As we neared the finish line, we encountered the final boss: the semicolon. We discovered that a single missing semicolon, which didn't produce an error message, was causing one of our several methods run endlessly.
## Accomplishments that we're proud of
We're proud of the tenacity that we demonstrated and learning we achieved. This was our first hackathon ever, so there was a mix of excitement and uncertainty. We're proud of the unwavering focus and ambitious hunger that we displayed. We created a full-stack program with no previous experience. We used Firebase for the first time and worked with some new APIs. Regardless of how the judging goes, we're proud of how far we've come.
## What we learned
What have we not learned? We've traversed the full-stack development process. Tommy mastered JavaScript in the span of 24 hours. Most of us were unfamiliar with React, so that was cool to learn. Firebase was an unfamiliar jungle that we explored. It was interesting to see all that went in to syncing data from the client and server sides. It was also nice to play with some new APIs.
## What's next for HoosHungry
HoosHungry has so much room to grow. As we mentioned earlier it was difficult to reel in our scope for this exciting project. The next steps would be to sharpen up the user interface and incorporate sharing through different platforms. Adding more restaurants and expanding our session hosting capabilities are other immediate directions to go. In a broader sense, HoosHungry can tap into meeting spaces other than food spots: libraries, recreation centers, parks, etc.