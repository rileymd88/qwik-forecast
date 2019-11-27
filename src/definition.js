define([], function (helper) {
  var aboutDefinition = {
    component: 'items',
    label: 'About',
    items: {
      header: {
        label: 'Qwik Forecast',
        style: 'header',
        component: 'text'
      },
      paragraph1: {
        label: `An easy way to create time series forecasts in Qlik Sense`,
        component: 'text'
      },
      paragraph2: {
        label: 'Created by Riley MacDonald.',
        component: 'text'
      }
    }
  };

  return {
    type: "items",
    component: "accordion",
    items: {
      about: aboutDefinition
    }
  };
});