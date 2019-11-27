/* eslint-disable max-len */
/* eslint-disable no-console */
var qlik = window.require('qlik');
import $ from 'jquery';
import dialogTemplate from './dialog.ng.html';
import Tagify from '@yaireo/tagify';

export default ['$scope', '$element', function ($scope, $element) {
  $scope.layoutId = $scope.layout.qInfo.qId;
  let enigma = $scope.component.model.enigmaModel;
  let app = qlik.currApp($scope);


  $scope.layout.getScope = function () {
    return $scope;
  };

  $scope.showDialog = async function (event) {
    $scope.measures = [];
    $scope.fields = await $scope.getFields();
    $scope.fields = $scope.fields.sort(compare);
    $scope.dateFields = await $scope.getDateFields();
    $scope.dateFields = $scope.dateFields.sort(compare);
    $scope.createTable = window.qvangularGlobal.getService("luiDialog").show({
      template: dialogTemplate,
      closeOnEscape: true,
      input: {
        fields: $scope.fields,
        dateFields: $scope.dateFields,
        measures: [{ "id": 1, "aggr": "Sum", "formula": "" }],
        measuresCount: 1,
        next: async function () {
          // Jquery hack due to using tagify lib to get all values
          for (let i = 0; i < this.measuresCount; i++) {
            let formula;
            try {
              formula = JSON.parse($(".qfMeasure").parent().children('textarea')[i].value)[0].value;
            }
            catch {
              formula = $(".qfMeasure").parent().children('textarea')[i].value;
            }
            this.measures[i].formula = formula;
          }
          let parentElement = $("#qfDate").parent().children('textarea');
          try {
            this.date = JSON.parse(parentElement[0].value)[0].value;
          }
          catch {
            this.date = parentElement[0].value;
          }
          try {
            this.dateAggr = JSON.parse(parentElement[1].value)[0].value;
          }
          catch {
            this.dateAggr = parentElement[1].value;
          }
          try {
            this.datePeriod = JSON.parse(parentElement[2].value)[0].value;
          }
          catch {
            this.datePeriod = parentElement[2].value;
          }
          this.key = [];
          for (let t = 0; t < $(".qfGroup").find(".tagify__tag-text").length; t++) {
            this.key.push($(".qfGroup").find(".tagify__tag-text")[t].innerText);
          }

          // Get table information for each field
          this.fields = [];
          this.fields.push({ "type": "date", "field": this.date });
          for (let k = 0; k < this.key.length; k++) {
            this.fields.push({ "type": "key", "field": this.key[k] });
          }
          for (let m = 0; m < this.measures.length; m++) {
            this.fields.push({ "type": "measure", "field": this.measures[m].formula });
          }
          for (let f = 0; f < this.fields.length; f++) {
            try {
              let fieldInfo = await enigma.app.getFieldDescription({ "qFieldName": this.fields[f].field });
              this.fields[f].tables = fieldInfo.qSrcTables;
            } catch (error) {
              console.error(error);
            }
          }
          let factTable;
          this.fields.filter(function (field) {
            return field.type == 'measure';
          }).map(function (field) {
            if (typeof factTable !== 'undefined' && factTable != field.tables[0]) {
              console.log('ok');
            }
            else {
              factTable = field.tables[0];
            }
            return field;
          });
          const params = {
            "qWindowSize": {
              "qcx": 0,
              "qcy": 0
            },
            "qNullSize": {
              "qcx": 0,
              "qcy": 0
            },
            "qCellHeight": 0,
            "qSyntheticMode": false,
            "qIncludeSysVars": false
          };
          try {
            this.tablesAndKeys = await enigma.app.getTablesAndKeys(params);
            console.log(this.tablesAndKeys);
          }
          catch (err) {
            console.error(err);
          }

          // Check if date is in fact table
          if (!this.fields[0].tables.includes(factTable)) {
            // Do stuff
          }

          let tablesToJoin = this.fields.filter(function (field) {
            return field.type !== 'measure';
          }).map(function (field) {
            return field.tables;
          }).reduce((prev, curr) => prev.concat(curr), []).filter((item, i, arr) => arr.indexOf(item) === i);
          tablesToJoin.remove(factTable);
          // Create script
          let script = '';
          this.fcKey = this.key.map(key => `[${key}]`).join('&');
          if (tablesToJoin.length < 1) {
            script += `[TMP_QWIK_FORECAST_${factTable}]:\n`;
            script += `NoConcatenate\n`;
            script += `LOAD *, \n`;
            script += `${this.fcKey} AS %FCKey\n`;
            script += `RESIDENT [${factTable}];\n\n`;
          }
          else {
            let keysNeedingMaps = this.fields.filter(function (item) {
              return !item.tables.includes(factTable) && item.type == 'key';
            });
            console.log(keysNeedingMaps);
            let factTableScript = `[${factTable}_QWIK]:\n`;
            factTableScript += `LOAD *,\n`;
            // Loop through all fields needing maps
            for (let k = 0; k < keysNeedingMaps.length; k++) {
              let mappingKey = '';
              // Find how the field is mapped
              for (let m = 0; m < this.tablesAndKeys.qk.length; m++) {
                // Found key
                if (this.tablesAndKeys.qk[m].qTables.includes(keysNeedingMaps[k].tables[0])) {
                  console.log('key 1', this.tablesAndKeys.qk[m].qKeyFields[0], keysNeedingMaps[k].tables[0]);
                  // Check to see if fact table is connected to same key
                  if (this.tablesAndKeys.qk[m].qTables.includes(factTable)) {
                    mappingKey = this.tablesAndKeys.qk[m].qKeyFields[0];
                    script += `[KEY${keysNeedingMaps[k].field}MAP]:\n`;
                    script += `MAPPING LOAD\n`;
                    script += `[${mappingKey}],\n`;
                    script += `[${keysNeedingMaps[k].field}]\n`;
                    script += `RESIDENT [${keysNeedingMaps[k].tables[0]}];\n\n`;
                  }
                  else {
                    // Remove field table from list
                    let otherTables = this.tablesAndKeys.qk[m].qTables.remove(keysNeedingMaps[k].tables[0]);
                    for (let t = 0; t < otherTables.length; t++) {
                      // Loop through other tables until other is found within qTables
                      for (let qk = 0; qk < this.tablesAndKeys.qk.length; qk++) {
                        if (this.tablesAndKeys.qk[qk].qTables.includes(otherTables[t]) && this.tablesAndKeys.qk[qk].qTables.includes(factTable)) {
                          script += `[KEY${keysNeedingMaps[k].field}_MAP_TMP]:\n`;
                          script += `MAPPING LOAD\n`;
                          script += `[${this.tablesAndKeys.qk[m].qKeyFields[0]}],\n`;
                          script += `[${keysNeedingMaps[k].field}]\n`;
                          script += `RESIDENT [${keysNeedingMaps[k].tables[0]}];\n\n`;
                          script += `[KEY${keysNeedingMaps[k].field}MAP]:\n`;
                          script += `MAPPING LOAD\n`;
                          script += `[${this.tablesAndKeys.qk[qk].qKeyFields[0]}],\n`;
                          script += `APPLYMAP('KEY${keysNeedingMaps[k].field}_MAP_TMP', [${this.tablesAndKeys.qk[m].qKeyFields[0]}]) as [${keysNeedingMaps[k].field}]\n`;
                          script += `RESIDENT [${otherTables[t]}];\n\n`;
                          console.log('key 2', this.tablesAndKeys.qk[qk].qKeyFields[0], otherTables[t]);
                          // Add key into fact table
                          factTableScript += `APPLYMAP('KEY${keysNeedingMaps[k].field}MAP', [${this.tablesAndKeys.qk[qk].qKeyFields[0]}])&`;
                        }
                      }
                    }
                  }
                }
              }
            }
            let keyNotNeedingMap = this.fields.filter(function (item) {
              return item.tables.includes(factTable) && item.type == 'key';
            });
            for (let n = 0; n < keyNotNeedingMap.length; n++) {
              factTableScript += `[${keyNotNeedingMap[n].field}]&`;
            }
            factTableScript = factTableScript.slice(0, -1);
            script += factTableScript;
            script += ` as %FCKey\n`;
            script += `RESIDENT [${factTable}];\n\n`;
            script += `[TMP_QWIK_FORECAST_${factTable}]:\n`;
            script += `NOCONCATENATE\n`;
            script += `LOAD * RESIDENT [${factTable}];\n`;
            script += `DROP TABLE [${factTable}];\n\n`;
          }

          for (let t = 0; t < tablesToJoin.length; t++) {
            script += `Join([TMP_QWIK_FORECAST_${factTable}])\n`;
            script += `LOAD * RESIDENT [${tablesToJoin[t]}];\n\n`;
          }
          script += `[QWIK_FORECAST_${factTable}]:\n`;
          script += `LOAD\n`;
          script += `${this.fcKey} as %FCKey,\n`;
          let dateField;
          switch (this.dateAggr) {
            case 'Daily':
              dateField = `[${this.date}],\n`;
              script += dateField;
              break;
            case 'Weekly':
              dateField = `WeekName([${this.date}])`;
              script += `${dateField} as [${this.date}_FC],\n`;
              break;
            case 'Monthly':
              dateField = `MonthName([${this.date}])`;
              script += `${dateField} as [${this.date}_FC],\n`;
              break;
          }
          for (let m = 0; m < this.measures.length; m++) {
            if (m == this.measures.length - 1) {
              script += `${this.measures[m].aggr}([${this.measures[m].formula}]) as [${this.measures[m].formula}_FC]\n`;
            }
            else {
              script += `${this.measures[m].aggr}([${this.measures[m].formula}]) as [${this.measures[m].formula}_FC],\n`;
            }
          }
          script += `RESIDENT [TMP_QWIK_FORECAST_${factTable}]\nGROUP BY ${dateField}, ${this.fcKey};\n\n`;
          //script += `DROP TABLE [TMP_QWIK_FORECAST_${factTable}];\n\n`;

          script += `TMP_MAX_DATE:\n`;
          script += `LOAD\n`;
          script += `Max([${this.date}_FC]) as MaxDate\n`;
          script += `RESIDENT [QWIK_FORECAST_${factTable}];\n\n`;

          script += `LET vMaxFCDate = Peek('MaxDate', 0, 'TMP_MAX_DATE');\n`;
          script += `DROP TABLE TMP_MAX_DATE;\n\n`;

          script += `TMP_FC:\n`;
          script += `LOAD DISTINCT \n`;
          script += `%FCKey\n`;
          script += `RESIDENT [QWIK_FORECAST_${factTable}];\n\n`;

          script += `JOIN(TMP_FC)\n`;
          script += `LOAD\n`;
          switch (this.dateAggr) {
            case 'Daily':
              script += `Date($(vMaxFCDate) + RowNo()) as [${this.date}_FC]\n`;
              break;
            case 'Weekly':
              script += `Date($(vMaxFCDate) + (RowNo() * 7)) as [${this.date}_FC]\n`;
              break;
            case 'Monthly':
              script += `AddMonths($(vMaxFCDate), RowNo()) as [${this.date}_FC]\n`;
              break;
          }
          script += `AUTOGENERATE ${this.datePeriod};\n\n`;

          script += `CONCATENATE([QWIK_FORECAST_${factTable}])\n`;
          script += `LOAD *,\n`;
          script += `1 as FutureFlag,\n`;
          for (let m = 0; m < this.measures.length; m++) {
            if (m == this.measures.length - 1) {
              script += `0 as [${this.measures[m].formula}_FC]\n`;
            }
            else {
              script += `0 as [${this.measures[m].formula}_FC],\n`;
            }
          }
          script += `RESIDENT TMP_FC;\n`;
          script += `DROP TABLE TMP_FC;`;
          console.log(script);

          let factParams = {
            qDimensions: [{
              qDef: {
                qFieldDefs: ["$Field"]
              }
            }],
            qMeasures: [{
              qDef: {
                qDef: `Sum({<$Table={'${factTable}'}>}1)`
              }
            }],
            qInitialDataFetch: [{
              qHeight: 500,
              qWidth: 2
            }]
          };
          try {
            let cube = await app.createCube(factParams);
            let fields = cube.layout.qHyperCube.qDataPages[0].qMatrix.map(function (item) {
              return item[0].qText;
            });
          } catch (error) {
            console.error(error);
          }
        },
        addMeasure: async function () {
          this.measures.push({ "id": this.measuresCount + 1, "aggr": "Sum", "formula": "" });
          this.measuresCount = this.measuresCount + 1;
          let querySelector = `textarea[name=qfMeasure${this.measuresCount}]`;
          while (!document.querySelector(querySelector)) {
            await new Promise(r => setTimeout(r, 10));
          }
          let measure = document.querySelector(querySelector);
          new Tagify(measure, {
            enforceWhitelist: true,
            whitelist: $scope.fields,
            callbacks: {
            },
            dropdown: {
              enabled: 0,
              maxItems: $scope.fields.length
            },
            mode: 'select'
          });
        },
        removeMeasure: function () {
          if (this.measuresCount != 1) {
            this.measures.pop();
            this.measuresCount = this.measuresCount - 1;
          }
        }
      }
    });
    let date = document.querySelector('textarea[name=qfDate]');
    new Tagify(date, {
      enforceWhitelist: true,
      whitelist: $scope.dateFields,
      callbacks: {
      },
      dropdown: {
        enabled: 0,
        maxItems: $scope.dateFields.length
      },
      mode: 'select'
    });
    let dateAggr = document.querySelector('textarea[name=qfDateAggr]');
    new Tagify(dateAggr, {
      enforceWhitelist: true,
      whitelist: ['Daily', 'Weekly', 'Monthly'],
      callbacks: {
      },
      dropdown: {
        enabled: 0,
        maxItems: 4
      },
      mode: 'select'
    });
    let datePeriod = document.querySelector('textarea[name=qfDatePeriod]');
    new Tagify(datePeriod, {
      enforceWhitelist: true,
      whitelist: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36'],
      callbacks: {
      },
      dropdown: {
        enabled: 0,
        maxItems: 36
      },
      mode: 'select'
    });
    let group = document.querySelector('textarea[name=qfGroup]');
    new Tagify(group, {
      enforceWhitelist: true,
      whitelist: $scope.fields,
      callbacks: {
      },
      dropdown: {
        enabled: 0,
        maxItems: $scope.fields.length
      }
    });

    let measure1 = document.querySelector('textarea[name=qfMeasure1]');
    new Tagify(measure1, {
      enforceWhitelist: true,
      whitelist: $scope.fields,
      callbacks: {
      },
      dropdown: {
        enabled: 0,
        maxItems: $scope.fields.length
      },
      mode: 'select'
    });
  };


  $scope.getFields = function () {
    return new Promise(function (resolve, reject) {
      try {
        app.getList("FieldList", function (model) {
          return resolve(model.qFieldList.qItems.map(function (item, i) {
            return item.qName;
          }));
        });
      }
      catch (err) {
        reject(err);
      }
    });
  };

  $scope.getDateFields = function () {
    return new Promise(function (resolve, reject) {
      try {
        app.getList("FieldList", function (model) {
          let list = model.qFieldList.qItems.filter(function (item) {
            return item.qTags.includes("$date");
          }).map(function (item) {
            return item.qName;
          });
          resolve(list);
        });
      }
      catch (err) {
        reject(err);
      }
    });
  };

  $scope.onDialogPopoverResize = function () {
    if ($scope.showDialog) {
      $scope.showDialog.close();
    }
  };

  // Function to get string expressions
  $scope.getExpression = function (expression) {
    return new Promise(function (resolve, reject) {
      try {
        app.createGenericObject({
          expression: {
            qStringExpression: expression
          }
        }, function (reply) {
          resolve(reply.expression);
        });
      }
      catch (err) {
        reject(err);
      }
    });
  };

  $scope.generateRandomId = function () {
    let random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return random;
  };

  String.prototype.replaceAll = function (searchStr, replaceStr) {
    var str = this;
    // no match exists in string?
    if (str.indexOf(searchStr) === -1) {
      // return string
      return str;
    }
    // replace and remove first match, and do another recursirve search/replace
    return (str.replace(searchStr, replaceStr)).replaceAll(searchStr, replaceStr);
  };

  Array.prototype.remove = function () {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
      what = a[--L];
      while ((ax = this.indexOf(what)) !== -1) {
        this.splice(ax, 1);
      }
    }
    return this;
  };


  function compare(a, b) {
    // Use toUpperCase() to ignore character casing
    const genreA = typeof a.toUpperCase !== 'undefined' ? a.toUpperCase() : a.value.toUpperCase();
    const genreB = typeof b.toUpperCase !== 'undefined' ? b.toUpperCase() : b.value.toUpperCase();
    let comparison = 0;
    if (genreA > genreB) {
      comparison = 1;
    } else if (genreA < genreB) {
      comparison = -1;
    }
    return comparison;
  }
}];