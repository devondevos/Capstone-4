import express from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import axios from 'axios';

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({extended:true}));
app.set('views','views');
app.set('view engine', 'ejs');
app.use(express.static('public'));

//limiter for requests, so i don't get penalized
const limiter = rateLimit({
    windowMs: 13 * 60 * 60 * 1000, // 13 hour window
    max: 5, // limit each IP to 5 requests per windowMs
});

app.use(limiter);

app.get('/', async (req,res) => {
    res.render('index.ejs', {data: "Waiting for information"})
})

app.post('/', async (req,res) => {
    //getting the location and amount of days, the user entered
    const userAddress = req.body.userAddress;
    const userSuburb = req.body.userSuburb;
    const userDays = req.body.userDays;

    //trying to find the location of the user to render the latitude and longitude to the API_URL
    const locationAPI = "https://nominatim.openstreetmap.org/search.php?q="+userAddress+"+"+userSuburb+"&format=jsonv2"
    try {
        const userLocation = await axios.get(locationAPI)

        //if there is data sent to the api
        if (userLocation.data && userLocation.data.length > 0) {
            //assigning the appropriate latitude and longitude values
            const userLatitude = userLocation.data[0].lat;
            const userLongitude = userLocation.data[0].lon;

            //the latitude and longitude is returned from the locationApi, from the location the user entered in
            const API_URL = "https://api.open-meteo.com/v1/forecast?latitude="+userLatitude+"&longitude="+userLongitude+"&hourly=temperature_2m&timezone=auto&forecast_days="+userDays;
            //returning the api with the details from the user
            const response = await axios.get(API_URL);
            //finding the respective data from the api
            const time = response.data.hourly.time
            const temperature_2m = response.data.hourly.temperature_2m

            //displaying the date and time on the client side from the api's
            const currentTimeAndDay = new Date();

            //grouping the time and the temperatures together
            const weatherApp = time.map((currentTime, index) => {
                const date = new Date(currentTime)
                //only want the time value which is the second value in the array, the first value is the year-month-day
                const timeOnly = currentTime.split('T')[1]
                //getting your current time
                const currentHour = currentTimeAndDay.getHours();
                let adjustedIndex;

                //checks if the current time is equal to the one send to the browser
                if (date.toDateString() === currentTimeAndDay.toDateString()) {
                    // For the current day, start from the nearest hour matching the current hour
                    const hourDifference = Math.abs(currentHour - date.getHours());
                    //only showing the 3rd value to the browser
                    adjustedIndex = index + (hourDifference % 3);
                } else {
                    // For other days, use the normal modulo 3
                    adjustedIndex = index % 3;
                }
                //checks if the returned time is the 3rd value
                if (date >= currentTimeAndDay && adjustedIndex % 3 === 0) {
                    return {
                        //values to display the information as i customized
                        date: date.toLocaleDateString('en-US', {weekday: 'long'}),
                        time: timeOnly,
                        temperature_2m: temperature_2m[index],
                    }
                }
                return null;
                //removes the other values, that is not the 3rd value
            }).filter(entry => entry !== null)
            res.render('index.ejs', {data:weatherApp, currentTimeAndDay:currentTimeAndDay.toLocaleDateString('en-US', {weekday: 'long', hour: 'numeric'})})
        } else {
            //if the location is not found
            console.error("No location data found");
            res.render('index.ejs', { data: [], errorMessage: "Location not found, try again, maybe don't type the street or avenue part." });
        }
    } catch (error) {
        //if the weatherApp breaks or fails to make a request
        console.error("Failed to make request: ", error.message);
        res.render('index.ejs', { data: [], errorMessage: "Error fetching data" });
    }    
})

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`)
})