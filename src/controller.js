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
        step: 1,
        title: 'Prepare Date: Select Date Fields and Parameters',
        forecastPeriods: 24,
        fields: $scope.fields,
        dateFields: $scope.dateFields,
        fieldType: [
          { "name": "Dimension", "value": "dim" },
          { "name": "Measure", "value": "mes" }
        ],
        field: 'dim',
        onFormulaButtonClicked: async function (id) {
          try {
            $(".lui-button.confirm.button").on('click.qwikForecast', function () {
              try {
                this.formula = $(".CodeMirror-line")[0].innerText;
              }
              catch (err) {
                this.formula = '';
              }
            });
          } catch (error) {
            console.error(error);
          }
        },
        next1: async function () {
          this.step = 2;
          //this.title = 'Prepare Data: Select Dimensions and Measures';
          try {
            let parentElement = $("#qfDate").parent().children('textarea');
            try {
              this.date = JSON.parse(parentElement[0].value)[0].value;
              this.masterDimension = `${this.date}_FC`;
            }
            catch {
              this.date = parentElement[0].value;
            }
            this.dateTable = await $scope.getExpression(`Only({<$Field={'${this.date}'}>}$Table)`);
            if (this.dateTable.length > 1) {
              this.showTable = true;
              let factParams = {
                qDimensions: [{
                  qDef: {
                    qFieldDefs: ["$Field"]
                  }
                }],
                qMeasures: [{
                  qDef: {
                    qDef: `Sum({<$Table={'${this.dateTable}'}>}1)`
                  }
                }],
                qInitialDataFetch: [{
                  qHeight: 500,
                  qWidth: 2
                }]
              };
              try {
                let cube = await app.createCube(factParams);
                this.tableFields = cube.layout.qHyperCube.qDataPages[0].qMatrix.map(function (item) {
                  return { "field": item[0].qText };
                });
              } catch (error) {
                console.error(error);
              }
            }
          } catch (error) {
            console.error(error);
          }
        },
        next2: async function () {
          //this.title = 'Prepare Front End: Select Measure For Forecasting';
          // Get field types
          for (let s = 0; s < $(".qfFieldType option:selected").length; s++) {
            let fieldType = $(".qfFieldType option:selected")[s].innerText;
            this.tableFields[s].fieldType = fieldType;
          }
          // Get dimension fields
          let dimsForScript = this.tableFields.filter(function (item) {
            return item.fieldType == 'Dimension';
          }).map(key => `[${key.field}]`).join(',\n');
          this.script = "///$tab Qwik Forecast\r\n";
          this.script += `[TMP_${this.dateTable}]:\n`;
          this.script += `LOAD\n`;
          this.script += `*,\n`;

          let parentElement = $("#qfDate").parent().children('textarea');
          try {
            this.dateAggr = JSON.parse(parentElement[1].value)[0].value;
          }
          catch {
            this.dateAggr = parentElement[1].value;
          }
          switch (this.dateAggr) {
            case 'Daily':
              this.script = `[${this.date}],\n`;
              break;
            case 'Weekly':
              this.script += `WeekStart([${this.date}]) as [${this.date}_FC]\n`;
              break;
            case 'Monthly':
              this.script += `MonthStart([${this.date}]) as [${this.date}_FC]\n`;
              break;
          }
          this.script += `RESIDENT [${this.dateTable}];\n`;
          this.script += `DROP TABLE [${this.dateTable}];\n\n`;
          this.script += `TMP_FC:\n`;
          this.script += `LOAD\n`;
          this.script += `1 as FutureFlag,\n`;
          this.script += `${dimsForScript}\n`;
          this.script += `RESIDENT [TMP_${this.dateTable}];\n\n`;
          this.script += `TMP_MAX_DATE:\n`;
          this.script += `LOAD\n`;
          this.script += `Max([${this.date}_FC]) as MaxDate\n`;
          this.script += `RESIDENT [TMP_${this.dateTable}];\n\n`;
          this.script += `LET vMaxFCDate = Peek('MaxDate', 0, 'TMP_MAX_DATE');\n`;
          this.script += `DROP TABLE TMP_MAX_DATE;\n\n`;
          this.script += `JOIN(TMP_FC)\n`;
          this.script += `LOAD\n`;
          switch (this.dateAggr) {
            case 'Daily':
              this.script += `Date($(vMaxFCDate) + RowNo()) as [${this.date}_FC]\n`;
              break;
            case 'Weekly':
              this.script += `Date($(vMaxFCDate) + (RowNo() * 7)) as [${this.date}_FC]\n`;
              break;
            case 'Monthly':
              this.script += `Date(AddMonths($(vMaxFCDate), RowNo())) as [${this.date}_FC]\n`;
              break;
          }
          this.datePeriod = this.forecastPeriods;
          this.script += `AUTOGENERATE ${this.datePeriod};\n\n`;
          this.script += `CONCATENATE([TMP_${this.dateTable}])\n`;
          this.script += `LOAD\n`;
          this.script += `* RESIDENT TMP_FC;\n`;
          this.script += `DROP TABLE TMP_FC;\n\n`;
          this.script += `RENAME TABLE [TMP_${this.dateTable}] to [${this.dateTable}];`;
          this.step = 3;
          this.extFunctions = await $scope.getExtFunctions();
          this.selectFunction = true;
          for (let e = 0; e < this.extFunctions.length; e++) {
            if (this.extFunctions[e] == 'PythonProphet.Prophet') {
              this.selectFunction = false;
            }
          }
          if (this.selectFunction) {
            let functions = document.querySelector('textarea[name=qfFunction]');
            new Tagify(functions, {
              enforceWhitelist: true,
              whitelist: this.extFunctions,
              callbacks: {
              },
              dropdown: {
                enabled: 0,
                maxItems: this.extFunctions.length
              },
              mode: 'select'
            });
          }
          let formula;
          if (typeof this.formula == 'undefined') {
            formula = '';
          }
          else {
            formula = this.formula;
          }
          this.masterMeasure = `PythonProphet.Prophet('', 0.05, [${this.date}_FC], ${formula}, ${this.dateAggr.toLowerCase()}, ${this.datePeriod}, 'yhat', 5, '')`;
        },
        next3: async function () {
          this.step = 4;
          //this.title = 'Finalize Setup';
          this.reloading = true;
          this.reloadMsg = 'Getting script\n';
          let script = await enigma.app.getScript();
          this.script = script + this.script;
          this.reloadMsg += 'Setting script\n';
          await enigma.app.setScript(this.script);
          this.reloadMsg += 'Reloading app\n';
          let reload = await enigma.app.doReload();
          this.reloading = false;
          if (reload == true) {
            this.reloadMsg += 'Reload finished\n';
          }
          else {
            this.reloadMsg += 'There was an error while reloading the app. Try debugging this in the load script\n';
          }
          let measure = await $scope.createMeasure('Forecast', this.masterMeasure);
          if (measure) {
            this.mesId = measure.id;
            this.reloadMsg += 'Master measure created\n';
          }
          else {
            this.reloadMsg += 'There was an error creating the master measure\n';
          }
          let dimension = await $scope.createDimension('Forecast Date', this.masterDimension);
          if (dimension) {
            this.dimId = dimension.id;
            this.reloadMsg += 'Master dimension created\n';
          }
          else {
            this.reloadMsg += 'There was an error creating the master dimension\n';
          }
          if (reload && measure && dimension) {
            this.reloadMsg += 'Setup is finished! You can now click the button to create a new line chart or close this dialog and use the newly created master item dimension and measure';
            this.error = false;
          }
          this.script = '';
        },
        createLineChart: async function () {
          let props = {
            "qInfo": {
              "qId": $scope.layoutId,
              "qType": "linechart"
            },
            "qHyperCubeDef": {
              "qDimensions": [
                {
                  "qLibraryId": this.dimId,
                  "qDef": {
                    "qGrouping": "N",
                    "qFieldDefs": [],
                    "qFieldLabels": [],
                    "qSortCriterias": [
                      {
                        "qSortByState": 0,
                        "qSortByFrequency": 0,
                        "qSortByNumeric": 1,
                        "qSortByAscii": 1,
                        "qSortByLoadOrder": 1,
                        "qSortByExpression": 0,
                        "qExpression": {
                          "qv": ""
                        },
                        "qSortByGreyness": 0
                      }
                    ],
                    "qNumberPresentations": [],
                    "qReverseSort": false,
                    "qActiveField": 0,
                    "qLabelExpression": "",
                    "autoSort": true,
                    "cId": "wdpTfQ",
                    "othersLabel": "Others"
                  },
                  "qNullSuppression": false,
                  "qIncludeElemValue": false,
                  "qOtherTotalSpec": {
                    "qOtherMode": "OTHER_OFF",
                    "qOtherCounted": {
                      "qv": "10"
                    },
                    "qOtherLimit": {
                      "qv": "0"
                    },
                    "qOtherLimitMode": "OTHER_GE_LIMIT",
                    "qSuppressOther": false,
                    "qForceBadValueKeeping": true,
                    "qApplyEvenWhenPossiblyWrongResult": true,
                    "qGlobalOtherGrouping": false,
                    "qOtherCollapseInnerDimensions": false,
                    "qOtherSortMode": "OTHER_SORT_DESCENDING",
                    "qTotalMode": "TOTAL_OFF",
                    "qReferencedExpression": {
                      "qv": ""
                    }
                  },
                  "qShowTotal": false,
                  "qShowAll": false,
                  "qOtherLabel": {
                    "qv": "Others"
                  },
                  "qTotalLabel": {
                    "qv": ""
                  },
                  "qCalcCond": {
                    "qv": ""
                  },
                  "qAttributeExpressions": [],
                  "qAttributeDimensions": [],
                  "qCalcCondition": {
                    "qCond": {
                      "qv": ""
                    },
                    "qMsg": {
                      "qv": ""
                    }
                  }
                }
              ],
              "qMeasures": [
                {
                  "qLibraryId": this.mesId,
                  "qDef": {
                    "qLabel": "",
                    "qDescription": "",
                    "qTags": [],
                    "qGrouping": "N",
                    "qDef": "",
                    "qNumFormat": {
                      "qType": "U",
                      "qnDec": 10,
                      "qUseThou": 0,
                      "qFmt": "",
                      "qDec": "",
                      "qThou": ""
                    },
                    "qRelative": false,
                    "qBrutalSum": false,
                    "qAggrFunc": "",
                    "qAccumulate": 0,
                    "qReverseSort": false,
                    "qActiveExpression": 0,
                    "qExpressions": [],
                    "qLabelExpression": "",
                    "autoSort": true,
                    "cId": "TsLH",
                    "numFormatFromTemplate": true
                  },
                  "qSortBy": {
                    "qSortByState": 0,
                    "qSortByFrequency": 0,
                    "qSortByNumeric": -1,
                    "qSortByAscii": 0,
                    "qSortByLoadOrder": 1,
                    "qSortByExpression": 0,
                    "qExpression": {
                      "qv": ""
                    },
                    "qSortByGreyness": 0
                  },
                  "qAttributeExpressions": [
                    {
                      "qExpression": `If([${this.date}_FC] > $(vMaxFCDate), Green(), Blue())`,
                      "qLibraryId": "",
                      "qAttribute": true,
                      "id": "colorByExpression"
                    }
                  ],
                  "qAttributeDimensions": [],
                  "qCalcCond": {
                    "qv": ""
                  },
                  "qCalcCondition": {
                    "qCond": {
                      "qv": ""
                    },
                    "qMsg": {
                      "qv": ""
                    }
                  }
                }
              ],
              "qInterColumnSortOrder": [
                0,
                1
              ],
              "qSuppressZero": false,
              "qSuppressMissing": true,
              "qInitialDataFetch": [
                {
                  "qLeft": 0,
                  "qTop": 0,
                  "qWidth": 17,
                  "qHeight": 500
                }
              ],
              "qReductionMode": "N",
              "qMode": "S",
              "qPseudoDimPos": -1,
              "qNoOfLeftDims": -1,
              "qAlwaysFullyExpanded": true,
              "qMaxStackedCells": 5000,
              "qPopulateMissing": false,
              "qShowTotalsAbove": false,
              "qIndentMode": false,
              "qCalcCond": {
                "qv": ""
              },
              "qSortbyYValue": 0,
              "qTitle": {
                "qv": ""
              },
              "qCalcCondition": {
                "qCond": {
                  "qv": ""
                },
                "qMsg": {
                  "qv": ""
                }
              },
              "qColumnOrder": [],
              "qLayoutExclude": {
                "qHyperCubeDef": {
                  "qStateName": "",
                  "qDimensions": [],
                  "qMeasures": [],
                  "qInterColumnSortOrder": [],
                  "qSuppressZero": false,
                  "qSuppressMissing": false,
                  "qInitialDataFetch": [],
                  "qReductionMode": "N",
                  "qMode": "S",
                  "qPseudoDimPos": -1,
                  "qNoOfLeftDims": -1,
                  "qAlwaysFullyExpanded": false,
                  "qMaxStackedCells": 5000,
                  "qPopulateMissing": false,
                  "qShowTotalsAbove": false,
                  "qIndentMode": false,
                  "qCalcCond": {
                    "qv": ""
                  },
                  "qSortbyYValue": 0,
                  "qTitle": {
                    "qv": ""
                  },
                  "qCalcCondition": {
                    "qCond": {
                      "qv": ""
                    },
                    "qMsg": {
                      "qv": ""
                    }
                  },
                  "qColumnOrder": []
                }
              }
            },
            "showTitles": true,
            "title": "",
            "subtitle": "",
            "footnote": {
              "qStringExpression": {
                "qExpr": "'Green = Forecast'"
              }
            },
            "showDetails": false,
            "visualization": "linechart",
            "isRecommended": true,
            "qLayoutExclude": {
              "disabled": {},
              "quarantine": {}
            },
            "refLine": {
              "refLines": []
            },
            "lineType": "line",
            "stackedArea": false,
            "separateStacking": true,
            "scrollStartPos": 0,
            "nullMode": "gap",
            "dataPoint": {
              "show": false,
              "showLabels": false
            },
            "gridLine": {
              "auto": true,
              "spacing": 2
            },
            "color": {
              "auto": false,
              "mode": "byExpression",
              "useBaseColors": "off",
              "paletteColor": {
                "index": 1
              },
              "useDimColVal": true,
              "useMeasureGradient": true,
              "persistent": false,
              "expressionIsColor": true,
              "expressionLabel": "",
              "measureScheme": "sg",
              "reverseScheme": false,
              "dimensionScheme": "12",
              "autoMinMax": true,
              "measureMin": 0,
              "measureMax": 10,
              "colorExpression": `If([${this.date}_FC] > $(vMaxFCDate), Green(), Blue())`
            },
            "legend": {
              "show": true,
              "dock": "auto",
              "showTitle": true
            },
            "dimensionAxis": {
              "continuousAuto": true,
              "show": "all",
              "label": "auto",
              "dock": "near"
            },
            "preferContinuousAxis": true,
            "showMiniChartForContinuousAxis": true,
            "measureAxis": {
              "show": "all",
              "dock": "near",
              "spacing": 1,
              "autoMinMax": true,
              "minMax": "min",
              "min": 0,
              "max": 10,
              "logarithmic": false
            }
          };
          //let lineChart = await app.visualization.create('linechart', props);
          //let lineId = lineChart.model.id;
          let thisObject = await enigma.app.getObject($scope.layoutId);
          thisObject.setProperties(props);
        }
      }
    });
    let scope = angular.element(document.querySelector('.lui-dialog')).scope().$parent;
    scope.$watch("input.formula", function (newValue, oldValue) {
      if (newValue !== oldValue) {
        scope.input.masterMeasure = `PythonProphet.Prophet('', 0.05, [${scope.input.date}_FC], ${scope.input.formula}, '${scope.input.dateAggr.toLowerCase()}', ${scope.input.datePeriod}, 'yhat', 5, '')`;
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
        maxItems: 3
      },
      mode: 'select'
    });
  };

  $scope.createMeasure = function (measureName, formula) {
    return new Promise(async function (resolve, reject) {
      try {
        let measure = await enigma.app.createMeasure({
          qInfo: {
            qId: '',
            qType: 'measure'
          },
          qMeasure: {
            qLabel: measureName,
            qDef: formula
          },
          qMetaDef: {
            title: measureName,
            description: ''
          }
        });
        resolve(measure);
      } catch (error) {
        reject(error);
      }
    });
  };

  $scope.createDimension = function (name, dimension) {
    return new Promise(async function (resolve, reject) {
      let dim = enigma.app.createDimension({
        qInfo: {
          qId: '',
          qType: 'dimension'
        },
        qDim: {
          qGrouping: 'N',
          qFieldDefs: [dimension],
          qFieldLabels: [dimension],
          title: name
        },
        qMetaDef: {
          title: name
        }
      });
      resolve(dim);
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

  $scope.getExtFunctions = function () {
    return new Promise(async function (resolve, reject) {
      try {
        let extFunctions = await enigma.app.global.getFunctions({ "qGroup": "EXT" });
        let functionNames = extFunctions.map(function (item) {
          return item.qName;
        }).sort(compare);
        resolve(functionNames);
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