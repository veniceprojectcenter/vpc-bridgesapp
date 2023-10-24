# Bridges Visualization
his application displays the location of all of the bridges in Venice, as well as their outline and information on a selected bridge. The map also displays which bridges are passable (green) or impassable (red) for boats of various heights at different sea levels. The sea level on the map defaults to the most recent water height measurement.

## Documentation
This application uses [CKdata](https://ckdata.herokuapp.com/) to get the data it's visualizing. CKdata in turn works with [this firebase](https://console.firebase.google.com/u/1/project/firebase-cityknowledge/overview) database.
the app is written in js and is static. it is deployed on [vercel](https://vercel.com/vpcprojects/bridges).

it tries to get the recent tide height value from [here](https://ckdata.herokuapp.com/realtime/venice_tide) but it seems like the api is not working
