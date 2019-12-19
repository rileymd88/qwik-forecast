# Qwik Forecast
A Qlik Sense extension which helps prepare your application for forecasting with a python analytic connection. It can be downloaded from here: https://github.com/rileymd88/qwik-forecast/releases. This extension only works when being used in combination with the Qwik Forecast Installer found here: https://github.com/rileymd88/qwik-forecast-installer

## Using Qwik Forecast
[![Qwik Forecast in Action](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast-video.PNG)](https://www.youtube.com/watch?v=cLJE_NYvgTM)

## Qwik Forecast Extension
This extension relies on the Qwik Forecast Installer being first installed to work. You can find the installer including further documentation here: https://github.com/rileymd88/qwik-forecast-installer 
1. Download the latest release from here: https://github.com/rileymd88/qwik-forecast/files/3974147/qwik-forecast.zip
2. Import the extension using the Qlik Management Console
3. Either create a new app with your data preferred data model or open an existing app
4. Locate the extension from the asset panel and drag it onto a new sheet

![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast1.PNG) 
5. Click on Start Forecast Setup to start the setup 
6. Select the following:
* The date you would like to use as a basis for your forecast. Qwik Forecast will only suggest fields which are tagged as $date. Hint: If you use the data manager Qlik will automatically detect and tag date fields as dates
* Select the aggregation level you would like to have for your forecast
* Select how many time periods you would like to forecast for. If you select months then this will be how many months in the future you would like to be able to forecast etc
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast2.PNG)
7. Hit next
8. You will now be presented with all fields in the table from the date you selected in the previous step. Ensure you look through the fields carefully and mark which fields should be treated as dimensions and which can be treated as measures. Hint: If you do not do this step correctly you could end up adding incorrect figures to your data model. When it doubt it is better to mark fields as measures
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast4.PNG)
9. Hit next
10. In this step you will now be prompted to create the base measure which you want to forecast into the future with. Hint) You can also see the master items and load script which Qwik Forecast will automatically correct by turning the preview switch on - If something looks wrong then you can go back to any of the previous steps and correct your input by hitting back 
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast6.PNG)
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast7.PNG)
11. Now you can hit Reload App & Create Master Items. Hint) This step will reload the app so ensure that you have the correct access to be able to reload the app
12. Do not worry if you receive an message saying an error occurred and that a reload is in process. This is a standard Qlik Sense Error message when reloading via APIs in the front end and you can simply click close once the app is done reloading
13. If all has run smoothly you should get the following feedback from Qwik Forecast
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast8.PNG)
14. Qwik Forecast has now successfully created a master dimension (Forecast Date) and a master measure (Forecast) for you. You can now either hit close and use those master items within your own visualization or you can click on Create Line Chart to have Qwik Forecast automatically convert itself into a standard Qlik Sense line chart using your newly created master items
15. If you chose to qlik on Create Line Chart you will get the following line chart. Hint: The line is green is when the forecast starts
![Qwik Forecast](https://raw.githubusercontent.com/rileymd88/data/master/qwik-forecast/qwik-forecast9.PNG)

# Developing the extension
If you want to do code changes to the extension follow these simple steps to get going.

1. Get Qlik Sense
2. Clone the repository
3. Run `npm install`
4. Run `npm run build` - to build a dev-version to the /dist folder.

## Release Notes v0.1
* First beta release

## Bugs and Requests
Please raise a github issue for any bugs or requests

# Original authors
[github.com/rileymd88](https://github.com/rileymd88)

# License
Released under the [MIT License](LICENSE).
