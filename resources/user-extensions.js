// ==========================================================================
// Project:   Lebowski Framework - The SproutCore Test Automation Framework
// License:   Licensed under MIT license (see License.txt)
// ==========================================================================
/*globals Selenium PageBot selenium */

/**
  This file contains all Lebowski framework extensions for the Selenium Core framework. 
  
  When starting up the selenium server, this file must be included in order for the
  Lebowski framework to properly communicate with the SproutCore framework and application.
  Example:
  
    java -jar selenium_server -userExtensions user-extensions.js
    
  There are three global variables used throughout this extension, which are:
  
    $SC     - References the SproutCore root object in the application window
    $App    - References the application's root object in the application window
    $ScPath - The path parser used to access values for a given path using the SC
              dot-path notation
  
  In order to use selenium extensions correctly the doOpenScApplication method on the
  Selenium object must be invoked. This method will assure that both the SproutCore framework
  and application object are found.
  
*/

/**
  There are two core global variables that are used to make it more convienient to program 
  against the SproutCore framework and the SC application under test. 
*/
var $SC = null;
var $App = null;

/**
  Root object that contains all the various helper objects for this extention
*/
var ScExt = {};

/**
  Checks if the given value is indeed an SC.Object
*/
ScExt.isScObject = function(obj) {
  return (obj && typeof(obj) === "object" && obj.kindOf && obj.kindOf($SC.Object));
};

/**
  Converts an SC.IndexSet into a basic JavaScript array
*/
ScExt.indexSet2Array = function(indexSet) {
  if (!indexSet) return [];
  var indexes = [];
  indexSet.forEach(function(index) {
    indexes.push(index);
  }, this);
  return indexes;
};

/**
  Converts a class name into an actuall SC class object. For instance, providing
  "SC.CollectionView" will convert into the SC.CollectionView class object. If
  a convertion can not be made then null is returned.
*/
ScExt.string2ScClass = function(className) {
  var klassParts = className.split('.');
  if (klassParts.length < 2) return null;

  var klass = selenium.browserbot.getCurrentWindow();
  for (var i = 0; i < klassParts.length; i++) {
    var part = klassParts[i];
    klass = klass[part];
    var type = typeof(klass);
    if (!klass || !(type === "object" || type === "function")) return null;
  }
 
  return klass;
};

/**
  Will call a given view's scrollToVisible method to assure that it is indeed
  visible to the user. The run loop is invoked to assure the views are all
  updated.
*/
ScExt.viewScrollToVisible = function(view) {
  $SC.RunLoop.begin();
  view.scrollToVisible();
  $SC.RunLoop.end();
};

/**
  Gets all the class names that the given object inherits from. For instance, if
  an object is of type SC.ButtonView, then the following will be returned
  in order:
  
    ["SC.ButtonView", "SC.View", "SC.Object"]
*/
ScExt.getScObjectClassNames = function(obj) {
  if (!ScExt.isScObject(obj)) return [];
  
  var classNames = [];
  var superclass = obj.constructor;
  while (superclass) {
    var sc = superclass.toString();
    if (classNames.indexOf(sc) < 0) {
      classNames.push(sc);
    }
    superclass = superclass.superclass;
  }
  return classNames;
};

/**
  Determines the make up of the given array. Returns an SC type constant if
  all the values in the array are of the same type. If the array is a mixture
  of type then "anonymous" is returned
*/
ScExt.typeOfArrayContent = function(array) {
  
  if (array.length === 0) return "empty";
  
  var stringCount = 0;
  var numberCount = 0;
  var boolCount = 0;
  var objectCount = 0;
  var hashCount = 0;
  var nullCount = 0;
  var undefinedCount = 0;
  
  for (var i = 0; i < array.length; i++ ) {    
    var value = array[i];
    var type = $SC.typeOf(value);
    if (type === $SC.T_STRING) {
      stringCount++;
    } else if (type === $SC.T_BOOL) {
      boolCount++;
    } else if (type === $SC.T_NUMBER) {
      numberCount++;
    } else if (type === $SC.T_OBJECT) {
      objectCount++;
    } else if (type === $SC.T_HASH) {
      hashCount++;
    } 
  }
  
  if (stringCount === array.length) return $SC.T_STRING;
  if (numberCount === array.length) return $SC.T_NUMBER;
  if (boolCount === array.length) return $SC.T_BOOL;
  if (objectCount === array.length) return $SC.T_OBJECT;
  if (hashCount === array.length) return $SC.T_HASH;
  return "anonymous";
  
};

/**
  The path parser is used to parse a given property path and return a value based
  on that path. If any part of the path evaluates to null then the path will stop
  being parsed and null will be returned.
  
  The standard SproutCore obj.getPath('some.path') approach is not used directly 
  since the property paths for this Selenium user extension has some additional 
  characteristics to make it easier to access values. 
*/
ScExt.PathParser = {
  
  _isArrayIndex: function (val) {
    return isNaN(parseInt(val, 0)) === false;
  },
  
  _isRootObject: function(value) {
    return value.match(/^\$/) === null ? false : true;
  },
  
  _isViewLayerId: function(value) {
    return value.match(/^#/) === null ? false : true;
  },
  
  _getViewByLayerId: function(value) {
    return $SC.View.views[value.replace('#', '')];
  },
  
  _getRootObject: function(value) {
    var win = selenium.browserbot.getCurrentWindow();
    return win[value.replace('$', '')];
  },
  
  _getObjectFromArray: function(array, index) {
    var i = parseInt(index, 0);
    if (array.objectAt) return array.objectAt(i);
    return array[i];
  },
  
  _getObjectFromFunction: function(target, func, index) {
    return func.call(target, parseInt(index, 0));
  },
  
  /**
    Computes a complete object chain from the given path. The chain
    represents all the objects used to access the final value from
    the property path. 
    
    Parts that make up the property paths can include functions, arrays
    and index values (e.g. 0, 1, 2...). When a function or array is
    included it must be followed by an index value. The index will then
    be passed back into the function or array. If a funtion is used then
    the function must be preceeded by an object.
    
    Examples:
    
      1> 'objA.objB.someValue'  // Property path not using indexing
      2> 'objA.someArray.3'     // Property path using indexing via an array (i.e. objA.someArray[3])
      3> 'objA.someFunction.4'  // Property path using indexing via a function (i.e. objA.someFunction(4))
      
    In example 2, the index 3 is supplied which follows the array. In example 3, 
    the index 4 is supplied following a function. The function 'someFunction' will
    be called against objA. In addition, it is assumed that someFunction only accepts
    one value.
  */
  computeObjectChain: function(path) {
    var parts = path.split('.');

    var objPathChain = []; 
    var current_obj = null;
    
    // Determine what the starting object is
    if (this._isRootObject(parts[0])) {
      current_obj = this._getRootObject(parts[0]);
    } else if (this._isViewLayerId(parts[0])) {
      current_obj = this._getViewByLayerId(parts[0]);
    } else {
      current_obj = $App.getPath(parts[0]);
    }
    
    objPathChain.push(current_obj);
    if ($SC.none(current_obj)) return objPathChain;
    
    for (var i = 1; i < parts.length; i++) {
      if (this._isArrayIndex(parts[i])) {
        if (typeof objPathChain[i - 1] === "function") {
          // Last part is a function, therefore invoke the function with the index
          var target = objPathChain[i - 2];
          var func = objPathChain[i - 1];
          current_obj = this._getObjectFromFunction(target, func, parts[i]);
        } else {
          // Just assume that the previous object in the object chain is an actual array
          var array = objPathChain[i - 1];
          current_obj = this._getObjectFromArray(array, parts[i]);
        }
      } else {
        if (current_obj.getPath && typeof current_obj.getPath === "function") {
          // Object is a SC object. Use the get method
          current_obj = current_obj.getPath(parts[i]);
        } else if (current_obj.get && typeof current_obj.get === "function") {
          current_obj = current_obj.get(parts[i]);
        } else {
          // Object is just a plain old JS object
          current_obj = current_obj[parts[i]];
        }
      }
    
      objPathChain.push(current_obj);
      if ($SC.none(current_obj)) return objPathChain;
    }

    return objPathChain;
  },
  
  getPath: function(path, scClass) {
    var chain = this.computeObjectChain(path);
    if (chain.length === 0 ) return null;
    var pathValue = chain[chain.length - 1];
    
    if (!scClass) return pathValue;
    
    if (ScExt.isScObject(pathValue) && pathValue.kindOf(scClass)) {
      return pathValue;
    } else {
      return null;
    }
  }
};

/**
  Convienient global variable to access the path parser since it is used so much. Use
  like so:
  
    var value = $ScPath.getPath('some.path.to.a.value');
    
*/
var $ScPath = ScExt.PathParser;

/**
  Used to simulate a mouse event using SproutCore's SC.Event object
*/
ScExt.MouseEventSimulation = {
  
  simulateEvent: function(mouseEvent, locator, x, y, button) {
    var element = selenium.browserbot.findElement(locator);
    event = $SC.Event.simulateEvent(element, mouseEvent, { 
      screenX: 0,
      screenY: 0,
      clientX: $SC.none(x) ? 0 : x,
      clientY: $SC.none(x) ? 0 : y,
      pageX: 0,
      pageY: 0,
      bubbles: true,
      button: $SC.none(button) ? 0 : button,
      altKey: selenium.browserbot.altKeyDown,
      metaKey: selenium.browserbot.metaKeyDown,
      ctrlKey: selenium.browserbot.controlKeyDown,
      shiftKey: selenium.browserbot.shiftKeyDown
    });
    $SC.Event.trigger(element, mouseEvent, event);
  },
  
  /**
    Will simulate a mouse down on a function key
  */
  mouseDown: function(locator, x, y) {
    this.simulateEvent('mousedown', locator, x, y, 0);
  },
  
  /**
    Will simulate a mouse up event
  */
  mouseUp: function(locator, x, y) {
    this.simulateEvent('mouseup', locator, x, y, 0);
  }, 
  
  /**
    Will simulate a right mouse down event
  */
  mouseDownRight: function(locator, x, y) {
    this.simulateEvent('mousedown', locator, x, y, Selenium.RIGHT_MOUSE_CLICK);
  },
  
  /**
    Will simulate a right mouse up event
  */
  mouseUpRight: function(locator, x, y) {
    this.simulateEvent('mouseup', locator, x, y, Selenium.RIGHT_MOUSE_CLICK);
  }
  
};

/**
  Used to simulate a key event using SproutCore's SC.Event object. This is 
  needed since not all browsers all you to create a key event and change the
  event's property. Meaning that the keyCode and charCode may be stuck with a
  0 value implying null. 
*/
ScExt.KeyEventSimulation = {
  
  _functionKeyCode: function(value) {
    for (var key in $SC.FUNCTION_KEYS) {
      if ($SC.FUNCTION_KEYS[key] == value) return key;
    }
    
    return null;
  },
  
  _printableKeyCode: function(value) {
    for (var key in $SC.PRINTABLE_KEYS) {
      if ($SC.PRINTABLE_KEYS[key] == value) return key;
    }
    
    return null;
  },

  /**
    Simulates a key event, such as key up, key down, key pressed. This is used to generate
    a key event for a SproutCore application since in some browsers it is not possible to
    dispatch a real key event, like in Apple's Safari. In Safari, when you try to generate
    a KeyboardEvent, the keyCode and charCode properties are read-only, and their values
    are set to 0 (null). 

    Note that since this only simulates a key event, the web browser will not be informed
    of the event and as such any type of form input field will also not pick up on the event.
    Therefore if you want to show a field being updated by the key event, you will also
    have to update the input field's value seperately.

    @param keyEvent {String} The key event to simulate (e.g. keyup, keydown)
    @param locator {String} The locator path to the DOM element that is to "receive" the key event
    @param keyCode {Integer} The key code for the key event. Represents the key on the keyboard
    @param charCode {Integer} The char code for the key event. Represents the logical character code
  */
  simulateEvent: function(keyEvent, locator, keyCode, charCode) {
    if (!keyCode && !charCode) return;

    var element = selenium.browserbot.findElement(locator);
    event = $SC.Event.simulateEvent(element, keyEvent, { 
      which: $SC.none(keyCode) ? charCode : keyCode, 
      charCode: charCode || 0, 
      keyCode: keyCode || 0, 
      altKey: selenium.browserbot.altKeyDown,
      metaKey: selenium.browserbot.metaKeyDown,
      ctrlKey: selenium.browserbot.controlKeyDown,
      shiftKey: selenium.browserbot.shiftKeyDown
    });
    
    $SC.Event.trigger(element, keyEvent, event);
  },
  
  /**
    Will simulate a key down on a function key
  */
  functionKeyDown: function(locator, key) {
    this.simulateEvent('keydown', locator, this._functionKeyCode(key), null);
    this.simulateEvent('keypress', locator, this._functionKeyCode(key), null); 
  },

  /**
    Will simulate a key up on a function key
  */
  functionKeyUp: function(locator, key) {
    this.simulateEvent('keyup', locator, this._functionKeyCode(key), null);
  },

  /**
    Will simulate a key down on a printable character
  */
  keyDown: function(locator, key) {
    this.simulateEvent('keydown', locator, null, key.charCodeAt(0));
    this.simulateEvent('keypress', locator, null, key.charCodeAt(0));
  },

  /**
    Will simulate a key up on a printable character
  */
  keyUp: function(locator, key) {
    this.simulateEvent('keyup', locator, this._printableKeyCode(key), null);
  }
  
};


/**
  TODO: This needs to be redone. The scheme used should something like JSON, not a 
  custom scheme. Got too experimental here.

  The object decoder is used to decode encoded hashes and arrays that have been sent to
  the browser via some Selenium remote control.
  
  The parts that make up a hash and array can have specified types that indicate how the
  part should be decoded. Types accepted are the following: 

    int     --> represent the value as an integer
    bool    --> represent the value as an boolean (true/false)
    regexp  --> represent the value as a regular expression (case sensitive)
    regexpi --> represent the value as a regular expression (case insensitive)
    hash    --> represent the value as a hash object
    array   --> represent the value as an array object

  If no type is specified then it is assumed the type is a string. all parts that are represented
  as a string must have the characters ,, :, [, ], and = be represented as the 
  following: [cma], [cln], [lsb], [rsb], [eql].
  
  Hashes (maps, dictionaries) follow a standard <key>=<value> pattern where <value> follows 
  the pattern [<type>:]<string> (see above). Examples of encoded hashes:
  
    foo=bar                   --> { "foo": "bar" }
    foo.bar=cat               --> { "foo.bar": "cat"}
    foo=cat,bar=dog           --> { "foo": "cat", "bar": "dog" }
    company=Acme[comma] Inc   --> { "company": "Acme, Inc" }
    foo=regexp:abc            --> { "foo": /abc/ }
    foo=regexpi:abc           --> { "foo": /abc/i }
    foo=regexp:a[eql]b        --> { "foo": /a=b/ }
    foo=int:100               --> { "foo": 100 }
    foo=100                   --> { "foo": "100" }
    foo=bool:true             --> { "foo": true }
    foo=bool:false            --> { "foo": false }
    foo=true                  --> { "foo": "true" }
    
  Depending on how the hash is being used, the key can be used as a SproutCore 
  property path. Therefore, the key can be something like "foo.bar.cat". 
  
*/
ScExt.ObjectDecoder = {
  
  _decodeEncodedChars: function(value) {
    if (value.match(/\[.*\]/)) {
      var val = value.replace(/\[cma\]/g, ",");
      val = val.replace(/\[cln\]/g, ":");
      val = val.replace(/\[eql\]/g, "=");
      val = val.replace(/\[lsb\]/g, "[");
      val = val.replace(/\[rsb\]/g, "]");
      return val;
    }
    
    return value;
  },
  
  _decodeValue: function(encodedValue) {
    var parts = encodedValue.match(/^(.*):(.*)/);
    if (parts) {
      var type = parts[1];
      var value = parts[2];
      
      if (type === "int") return parseInt(value, 10);
      if (type === "bool") return value === "true" ? true : false;
      if (type === "hash") return this.decodeHash(this._decodeEncodedChars(value));
      if (type === "array") return this.decodeArray(this._decodeEncodedChars(value));
      if (type === "regexp") return new RegExp(this._decodeEncodedChars(value));
      if (type === "regexpi") return new RegExp(this._decodeEncodedChars(value), "i");
      if (type === "null") return null;
      if (type === "undefined") return undefined;
      
      // Assume value is just a regular string
      return this._decodeEncodedChars(value);
    } 
    
    return this._decodeEncodedChars(encodedValue);
  },
  
  /**
    Decodes an encoded array. Returns a hash object
  */
  decodeArray: function(encodedArray) {
    var parts = encodedArray.split(',');
    
    var array = [];
    for (var i = 0; i < parts.length; i++) {
      var value = parts[i];
      array.push(this._decodeValue(value));
    }
    
    return array;
  },
  
  /**
    Decodes an encoded hash. Returns a hash object
  */
  decodeHash: function(encodedHash) {
    var parts = encodedHash.split(',');
    
    var hash = {};
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var args = part.split('=');
      var key = args[0];
      var value = args[1];
      hash[key] = this._decodeValue(value);
    }
    
    return hash;
  }
  
};

/**
  Used to lookup objects in an enumerable type based on a set of filter
  criteria. Calling the lookup method will return an array of objects that
  match the given filter criteria. Calling the lookupIndexes will return
  an array of indexes for the objects that match the given filter criteria.
  
  A filter is a hash object made up of key-value pairs. The key represent
  the key/property on the objects to check against. The value is what to 
  match again for the given key. Values can either be strings, numbers,
  boolean values, or regular expressions. There are special filter criteria
  keys that can also be used such as sc_guid and sc_type.
  
  Some examples filters are the following:
  
    { name: 'foo', age: 20 }
    { company: /inc$/i }
    { isEmployeed: true }
    { sc_type: 'SC.ButtonView' }
    { sc_guid: 'sc8934' }
    
  A matching object are those objects that meet all of the filer criteria. 
  As an example, let's say we have the following object array:
  
    [
      SC.Object.create({ name: 'foo' }),
      SC.Object.create({ name: 'foobar' }),
      SC.Object.create({ name: 'bar' })
    ]
    
  and our filter is { name: /foo/i }, then only the first and second objects
  in the array match.
*/
ScExt.ObjectArrayLookup = {
  
  LOOKUP_KEY_SC_GUID: "sc_guid",
  LOOKUP_KEY_SC_TYPE: 'sc_type',
  
  _isMatchingObject: function(object, filter) {
    
    var klass = null;
    if (!$SC.none(filter[this.LOOKUP_KEY_SC_TYPE])) {
      klass = ScExt.string2ScClass(filter[this.LOOKUP_KEY_SC_TYPE]);
    }
    
    for (var key in filter) {
      var value = filter[key];
      if (key === this.LOOKUP_KEY_SC_GUID) {
        if (value !== $SC.guidFor(object)) return false;
      }
      else if (key === this.LOOKUP_KEY_SC_TYPE) {
        if (!object.isObject) return false;
        if (!object.kindOf(klass)) return false;
      }
      else {
        var objValue = object.get ? object.get(key) : object[key];
        if (objValue === undefined) return false;
        if (value instanceof RegExp) {
          if (!(typeof(objValue) === "string")) return false;
          if (!objValue.match(value)) return false;
        } else {
          if (objValue !== value) return false;
        }
      }
    }
    
    return true;
  },
  
  lookupIndexes: function(objects, filter) {
    if (!objects || !filter) return null;
    
    if (!(filter instanceof Object)) return null;
    
    if (!objects.isSCArray) {
      if (!objects.isEnumerable) return null;
      objects = objects.toArray();
    }
    
    var matches = [];
    for (var index = 0; index < objects.get('length'); index++) {
      var obj = objects.objectAt(index);
      var match = this._isMatchingObject(obj, filter);
      if (match) {
        matches.push(index);
        if (!$SC.none(filter[this.LOOKUP_KEY_SC_GUID])) return matches;
      }
    }
    
    return matches;
  },
  
  lookup: function(objects, filter) {
    var indexes = this.lookupIndexes(objects, filter);
    var objs = [];
    for (var i = 0; i < indexes.length; i++) {
      objs.push(objects.objectAt(indexes[i]));
    }
    
    return objs;
  }
  
};

/**
  Used specifically to check for special properties assigned to a collection
  view's content objects via an assigned content delegate.
*/
ScExt.CollectionView = {
  
  _validIndex: function(collectionView, index) {
    var content = collectionView.get('content');
    return (typeof index === "number" && index >= 0 && index < content.get('length'));
  },

  getContentGroupIndexes: function(collectionView) {
    var content = collectionView.get('content'); 
    var del = collectionView.get('contentDelegate');
    var suggestedGroupIndexes = del.contentGroupIndexes(collectionView, content);
    if (!suggestedGroupIndexes) return [];

    var confirmedGroupindexes = [];
    
    suggestedGroupIndexes.forEach(function(index) {
      if (del.contentIndexIsGroup(collectionView, content, index)) {
        confirmedGroupindexes.push(index);
      }
    }, this);

    return confirmedGroupindexes;
  },
  
  getContentIsSelected: function(collectionView, index) {
    if (!this._validIndex(collectionView, index)) return false;
    var content = collectionView.get('content');
    var obj = content.objectAt(index);
    var selection = collectionView.get('selection');
    if (!selection) return false;
    var value = selection.containsObject(obj);
    return value;
  },
  
  getContentIsGroup: function(collectionView, index) {
    if (!this._validIndex(collectionView, index)) return false;
    var content = collectionView.get('content');
    var del = collectionView.get('contentDelegate');
    var suggestedGroupIndexes = del.contentGroupIndexes(collectionView, content);
    if (!suggestedGroupIndexes.contains(index)) return false;
    var value = del.contentIndexIsGroup(collectionView, content, index);
    return value;
  },
  
  getContentDisclosureState: function(collectionView, index) {
    if (!this._validIndex(collectionView, index)) return -1;
    var content = collectionView.get('content');
    var del = collectionView.get('contentDelegate');
    var value = del.contentIndexDisclosureState(collectionView, content, index);  
    return value;
  },
  
  getContentOutlineLevel: function(collectionView, index) {
    if (!this._validIndex(collectionView, index)) return -1;
    var content = collectionView.get('content');
    var del = collectionView.get('contentDelegate');
    var value = del.contentIndexOutlineLevel(collectionView, content, index);  
    return value;
  }

};

///////////////////// Selenium Core API Extensions - Actions for Testing ////////////////////////////////////

/**
  Private. This is intended for debugging/testing purposes only
*/
Selenium.prototype.doScTestObjectArrayLookup = function(params) {
  var hash = ScExt.ObjectDecoder.decodeHash(params);
  var key = hash.key;
  var path = hash.path;
  var lookupParams = hash.lookup;
  
  var array = $ScPath.getPath(path);
  var objs = ScExt.ObjectArrayLookup.lookup(array, lookupParams);
  if (!window.$__looked_up_array_objects__) window.$__looked_up_array_objects__ = {};
  window.$__looked_up_array_objects__[key] = {
    path: path,
    array: array,
    lookupParams: lookupParams,
    objects: objs
  };
};

/**
  Private. This is intended for debugging/testing purposes only
*/
Selenium.prototype.doScTestComputePropertyPath = function(key, path) {
  var chain = ScExt.PathParser.computeObjectChain(path);
  var value = ScExt.PathParser.getPath(path);
  if (!window.$__computed_property_paths__) window.$__computed_property_paths__ = {};
  window.$__computed_property_paths__[key] = {
    path: path,
    objChain: chain,
    value: value
  };
};

/**
  Private. This is intended for debugging/testing purposes only
*/
Selenium.prototype.doScTestDecodingEncodedHash = function(key, hash) {
  var obj = ScExt.ObjectDecoder.decodeHash(hash);
  if (!window.$__decoded_hashes__) window.$__decoded_hashes__ = {};
  window.$__decoded_hashes__[key] = {
    encoded: hash,
    decoded: obj
  };
};

/**
  Private. This is intended for debugging/testing purposes only
*/
Selenium.prototype.doScTestDecodingEncodedArray = function(key, array) {
  var obj = ScExt.ObjectDecoder.decodeArray(array);
  if (!window.$__decoded_arrays__) window.$__decoded_arrays__ = {};
  window.$__decoded_arrays__[key] = {
    encoded: array,
    decoded: obj
  };
};

///////////////////// Selenium Core API Extensions - Action to Setup User Extensions File ////////////////////////////////////

/**
  Sets the name of the SproutCore-based application. This is important as
  it will eventually be used to initalize the $App core global variable. This
  must be done before calling doInitializeScSeleniumExtension.
*/
Selenium.prototype.doSetScApplicationName = function(name) {
  this._sc_applicationName = name;
};

/**
  Main method to be invoked before you start to test a SproutCore-based
  application. This method will check to make sure the SproutCore framework
  and application are indeed loaded and accessible. In addition, it is
  solely responsible for setting up the core global variables to program
  again the SC framework and application.
*/
Selenium.prototype.doOpenScApplication = function(appRootPath, timeoutInSeconds) {

  var bot = selenium.browserbot;
  var win = bot.getCurrentWindow();
  var loc = bot.baseUrl + appRootPath;
  
  if (win.location.href !== loc) win.location.href = loc;
  
  // First set up closure
  var appName = this._sc_applicationName;
  
  var timeout = timeoutInSeconds ? (parseInt(timeoutInSeconds, 10) * 1000) : Selenium.DEFAULT_TIMEOUT;
  
  // Now run the wait function which will keep checking until
  // either the SproutCore framework and application are found or
  // the time out is reached. The function will also set up some
  // core global variables to make it easier to program againt
  // the SC framework and application
  return Selenium.decorateFunctionWithTimeout(function () {
    
    var win = selenium.browserbot.getCurrentWindow();
    
    // First check if there is a SproutCore framework
    if (!win.SC) return false;
    $SC = win.SC; // Set up the first core global variable
    
    // Found SC. Now check for the root application object
    var application = win[appName];
    if (!application) return false;
    $App = application; // Set up the second core global variable
  
    return true;
  }, timeout, this);
};

///////////////////// Selenium Core API Extensions - Actions ////////////////////////////////////

/**
  Move the application window to a given x-y coordinate
*/
Selenium.prototype.doScWindowMoveTo = function(x, y) {
  var win = selenium.browserbot.getCurrentWindow();
  win.moveTo(x*1, y*1);
};

/**
  Resize the application window by a width and height
*/
Selenium.prototype.doScWindowResizeTo = function(width, height) {
  var win = selenium.browserbot.getCurrentWindow();
  win.resizeTo(width*1, height*1);
};

/**
  Maximizes the applicaiton window
*/
Selenium.prototype.doScWindowMaximize = function() {
  var win = selenium.browserbot.getCurrentWindow();
  win.resizeTo(window.screen.availWidth, window.screen.availHeight);
  win.moveTo(1,1); // Slight offset from origin so that Firefox will actually move the window
};

/** 
  Action to call a view's scrollToVisible method. The path must point
  to an actual SC view object.
*/
Selenium.prototype.doScViewScrollToVisible = function(path) {
  var view = $ScPath.getPath(path, $SC.View);
  if (!view) return;
  ScExt.viewScrollToVisible(view);
};

/**
  Action to raise a mouse down event
*/
Selenium.prototype.doScMouseDown = function(locator) {
  try {
    this.doMouseDown(locator);
  } catch (ex) {}
};

/**
  Action to raise a mouse up event
*/
Selenium.prototype.doScMouseUp = function(locator) {
  try {
    this.doMouseUp(locator);
  } catch (ex) {}
};

/**
  Action to raise a right mouse down event
*/
Selenium.prototype.doScMouseDownRight = function(locator) {
  try {
    this.doMouseDownRight(locator);
  } catch (ex) {}
};

/**
  Action to raise a right mouse up event
*/
Selenium.prototype.doScMouseUpRight = function(locator) {
  try {
    this.doMouseUpRight(locator);
  } catch (ex) {}
};

/**
  Action performs a single click that is recognized by the SproutCore framework. 
*/
Selenium.prototype.doScClick = function(locator) {
  this.doScMouseDown(locator);
  this.doScMouseUp(locator);
};

/**
  Action performs a single right click that is recognized by the SproutCore framework. 
*/
Selenium.prototype.doScRightClick = function(locator) {
  this.doScMouseDownRight(locator);
  this.doScMouseUpRight(locator);
};

/**
  Action performs a double click that is recognized by the SproutCore framework. 
*/
Selenium.prototype.doScDoubleClick = function(locator) {
  this.doScClick(locator);
  this.doScClick(locator);
};

/** @private
  Check that the element is a valid text entry field
*/
Selenium.prototype._validTextEntryField = function(element) {
  var isTextInputField = element.tagName.toLowerCase() === 'input' && element.type.toLowerCase() === "text";
  var isTextArea = element.tagName.toLowerCase() === 'textarea';
  return isTextInputField || isTextArea; 
};

/**
  Action performs a key down on a printable character
*/
Selenium.prototype.doScKeyDown = function(locator, key) {
  ScExt.KeyEventSimulation.keyDown(locator, key);
  
  var element = this.browserbot.findElement(locator);
  
  if (this._validTextEntryField(element)) {
    var value = element.value;
    if (this.browserbot.shiftKeyDown) key = key.toUpperCase();
    value = value + key;
    element.value = value;
    $SC.Event.trigger(element, 'change');
  }
};

/**
  Action performs a key up on a printable character
*/
Selenium.prototype.doScKeyUp = function(locator, key) {
  ScExt.KeyEventSimulation.keyUp(locator, key);
};

/**
  Action performs a key down on a function key
*/
Selenium.prototype.doScFunctionKeyDown = function(locator, key) {
  ScExt.KeyEventSimulation.functionKeyDown(locator, key);
  
  var element = this.browserbot.findElement(locator);
  
  if (this._validTextEntryField(element)) {  
    // Need to simulate special function keys
    var value = element.value;
    if (key === 'backspace' || key === 'delete') {
      if (value.length > 0) {
        element.value = value.slice(0, value.length - 1);
        $SC.Event.trigger(element, 'change');
      }
    }
    else if (key === 'insert' || key === 'return') {
      value = value + '\n';
      element.value = value;
      $SC.Event.trigger(element, 'change');
    }
  }
};

/**
  Action performs a key up on a function key
*/
Selenium.prototype.doScFunctionKeyUp = function(locator, key) {
  ScExt.KeyEventSimulation.functionKeyUp(locator, key);
};

/**
  Action performs a typing of an individual function key. A key down followed by
  a key up event.
*/
Selenium.prototype.doScTypeFunctionKey = function(locator, key) {
  this.doScFunctionKeyDown(locator, key);
  this.doScFunctionKeyUp(locator, key);
};

/**
  Action performs a typing of an individual printable character. A key down followed by
  a key up event.
*/
Selenium.prototype.doScTypeKey = function(locator, key) {
  this.doScKeyDown(locator, key);
  this.doScKeyUp(locator, key);
};

/**
  Used to perform clean up on a core query object when no longer used

  @see #getScCoreQuery
*/
Selenium.prototype.doScCoreQueryDone = function(handle) {
  this._unregisterCoreQueryObject(handle);
};

///////////////////// Selenium Core API Extensions - Accessors ////////////////////////////////////

/**
  Returns the SproutCore type for the given path. If the path does not
  point to a SproutCore object the null is returned.
*/
Selenium.prototype.getScTypeOf = function(path) {
  var value = $ScPath.getPath(path);
  return $SC.typeOf(value);
};

/**
  Returns the basic SproutCore type for the content that make up an
  array. If the path does not point to an array then an empty string
  is returned.
*/
Selenium.prototype.getScTypeOfArrayContent = function(path) {
  var array = $ScPath.getPath(path);
  if ($SC.typeOf(array) !== $SC.T_ARRAY) return "";
  
  return ScExt.typeOfArrayContent(array);
};

/**
  Returns a SproutCore object's GUID
*/
Selenium.prototype.getScGuid = function(path) {
  var value = $ScPath.getPath(path, $SC.Object);
  var guid = $SC.guidFor(value);
  return guid;
};

/**
  Returns a SproutCore object's type
*/
Selenium.prototype.getScObjectClassName = function(path) {
  var obj = $ScPath.getPath(path, $SC.Object);
  if (!obj) return "";
  var className = $SC._object_className(obj.constructor);
  return (className === 'Anonymous') ? "" : className;
};

/**
  Checks if a SproutCore object is a kind of type
*/
Selenium.prototype.isScObjectKindOfClass = function(path, className) {
  var obj = $ScPath.getPath(path, $SC.Object);
  if (!obj) return false;
  
  var klass = ScExt.string2ScClass(className);
  if (!klass) return false;
  
  return obj.kindOf(klass);
};

/**
  Returns an array of strings representing all the classes a SproutCore
  object derives from. 
*/
Selenium.prototype.getScObjectClassNames = function(path) {
  var obj = $ScPath.getPath(path, $SC.Object);
  var classNames = ScExt.getScObjectClassNames(obj);
  return classNames;
};

/**
  Accessor gets a value from a given property path
*/
Selenium.prototype.getScPropertyValue = function(path) {
  var value = $ScPath.getPath(path);
  return value;
};

/**
  Accessor gets a localized string from the given string provided. This is done
  through the SproutCore framework.
*/
Selenium.prototype.getScLocalizedString = function(str) {
  var win = this.browserbot.getCurrentWindow();
  return win.eval("'" + str + "'.loc()");
};

/**
  Gets the layer of a view. In order to transfer data back to server, the
  method actually returns the outer HTML of the layer instead of having translate
  DOM elements into a string. 
*/
Selenium.prototype.getScViewLayer = function(path) {
  var view = $ScPath.getPath(path, $SC.View);
  if (!view) return "";
  return view.get('layer').outerHTML;
};

/**
  Gets a SproutCore view's frame
*/
Selenium.prototype.getScViewFrame = function(path) {
  var view = $ScPath.getPath(path, $SC.View);
  if (!view) return "";
  var frame = view.get('frame');
  if (!frame) return null;
  return [frame.width, frame.height, frame.x, frame.y];
};

/**
  Gets a DOM element's current window position
*/
Selenium.prototype.getScElementWindowPosition = function(path) {
  var x = this.getElementPositionLeft(path);
  var y = this.getElementPositionTop(path);
  return [x, y];
};

/**
  Gets the indexes of objects in an array that match a given lookup filter
*/
Selenium.prototype.getScObjectArrayIndexLookup = function(path, lookupParams) {
  var params = ScExt.ObjectDecoder.decodeHash(lookupParams);
  var array = $ScPath.getPath(path);
  var indexes = ScExt.ObjectArrayLookup.lookupIndexes(array, params);
  return indexes;
};

/////// SC Core Query Specific Selenium Calls /////////////////

/**
  Accessor is used to create a core query object based on a given CSS selector. The core query
  object is obtained through a view using a SC property path. Once the core query object is
  created an numeric handle ID is returned so that you can use subsequent commands to use
  the object.
  
  Always call this method first before using any other related methods since they all require
  a handler to a core query object.
  
  When finished with the core query, call doScCoreQueryDone to release the handle
  
  @return a positive handle ID if the path provided points to a view object, 
          otherwise -1 is returned
*/
Selenium.prototype.getScCoreQuery = function(path, selector) {   
  var view = $ScPath.getPath(path, $SC.View);
  if (!view) return -1;
  
  var cq = null;
  cq = (!selector || selector === "") ? view.$() : view.$(selector);
  
  var handle = this._registerCoreQueryObject(cq);
  
  return handle;
};

/**
  Will register a SC core query object. Once registered a handler will be
  returned in order to access the core object for subsequent use.
  
  @return a numeric handler that is used to access the core query object
  
  @see #_getCoreQueryObject
*/
Selenium.prototype._registerCoreQueryObject = function(cq) {
  if (!this._registeredCoreQueries) this._registeredCoreQueries = {};
  if (!this._nextCoreQueryHandle) this._nextCoreQueryHandle = 0;
  
  // Using ++ operator has a bizarre quirk in JS
  this._nextCoreQueryHandle = this._nextCoreQueryHandle + 1;
  
  this._registeredCoreQueries["handle_" + this._nextCoreQueryHandle] = cq;
  
  return this._nextCoreQueryHandle;
};

/**
  Will unregister a registered core query object. This will help free it from
  memory. 
  
  @see #_registerCoreQueryObject
*/
Selenium.prototype._unregisterCoreQueryObject = function(handle) {
  if (!this._registeredCoreQueries) return;
  delete this._registeredCoreQueries["handle_" + handle]; 
};

/**
  Used to retrieved a registered core query object using a handler. If
  the handler does not point to a core query object then null is returned.
  
  @see #_registerCoreQueryObject
*/
Selenium.prototype._getCoreQueryObject = function(handle) {
  if (!this._registeredCoreQueries) return null;
  return this._registeredCoreQueries["handle_" + handle];
};

/**
  Will get the number of elements contained in the core query object based on
  the selector used.

  @param handle {Number} the handle to the core query object
  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQuerySize = function(handle) {
  var cq = this._getCoreQueryObject(handle);
  return cq.size();
};

/**
  Will get an element's classes. The element comes from a core query object.
  
  @param handle {Number} the handle to the core query object
  @param elemIndex {Number} index to the element in the core query object
  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQueryElementClasses = function(handle, elemIndex) {
  var cq = this._getCoreQueryObject(handle);
  var elem = cq.get(elemIndex);
  if (!elem) return "";
  return elem.className;
};

/**
  Will get an element's outer HTML. The element comes from a core query object.

  @param handle {Number} the handle to the core query object
  @param elemIndex {Number} index to the element in the core query object
  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQueryElementHTML = function(handle, elemIndex) {
  var cq = this._getCoreQueryObject(handle);
  var elem = cq.get(elemIndex);
  if (!elem) return "";
  return elem.outerHTML;
};

/**
  Will get an element's attribute. The element comes from a core query object. The
  attribute can be any attribute you find on a DOM element. 
  
  @param handle {Number} the handle to the core query object
  @param elemIndexPlusAttr {String} must follow the patter <elem index>:<attribute>, where
         <elem index> is the index to the DOM element in the core query object and
         <attribute> is the attribute you want to get from the element. Because of the way
         the Selenium Core works, you are only allowed to provide a command two argments, 
         which is very silly. So the second and third argument had to be combined into one. 
         Hence the need to follow a pattern. For more details see the following function:
         
           _createCommandFromRequest
           
         located in the selenium-remoterunner.js file

  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQueryElementAttribute = function(handle, elemIndexPlusAttr) {
  var arg2 = elemIndexPlusAttr.split(':');
  var elemIndex = arg2[0];
  var attr = arg2[1];
  
  var cq = this._getCoreQueryObject(handle);
  var elem = cq.get(elemIndex);
  if (!elem) return "";
  return elem.getAttribute(attr);
};

/**
  Will get an element's text. The element comes from a core query object.
  
  @param handle {Number} the handle to the core query object
  @param elemIndex {Number} index to the element in the core query object
  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQueryElementText = function(handle, elemIndex) {
  var cq = this._getCoreQueryObject(handle);
  var elem = cq.get(elemIndex);
  if (!elem) return "";
  if (elem.textContent) return elem.textContent;
  if (elem.text) return elem.text;
  return "";
};

/**
  Will get an element's HTML tag. The element comes from a core query object.
  
  @param handle {Number} the handle to the core query object
  @param elemIndex {Number} index to the element in the core query object
  @see #getScCoreQuery
*/
Selenium.prototype.getScCoreQueryElementTag = function(handle, elemIndex) {
  var cq = this._getCoreQueryObject(handle);
  var elem = cq.get(elemIndex);
  if (!elem) return "";
  return elem.tagName;
};

/////// SC Collection View Specific Selenium Calls /////////////////

Selenium.prototype.getScCollectionViewContentGroupIndexes = function(path) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) return [];
  return ScExt.CollectionView.getContentGroupIndexes(collectionView);
};

Selenium.prototype.getScCollectionViewContentSelectedIndexes = function(path) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) return [];
  var selectionSet = collectionView.get('selection');
  if (!selectionSet) return [];
  var content = collectionView.get('content');
  return ScExt.indexSet2Array(selectionSet.indexSetForSource(content));
};

Selenium.prototype.getScCollectionViewContentNowShowingIndexes = function(path) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) return [];
  return ScExt.indexSet2Array(collectionView.get('nowShowing'));
};

Selenium.prototype.getScCollectionViewContentIsGroup = function(path, index) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) -1;
  return ScExt.CollectionView.getContentIsGroup(collectionView, parseInt(index, 0));
};

Selenium.prototype.getScCollectionViewContentIsSelected = function(path, index) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) -1;
  return ScExt.CollectionView.getContentIsSelected(collectionView, parseInt(index, 0));
};

Selenium.prototype.getScCollectionViewContentDisclosureState = function(path, index) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) -1;
  return ScExt.CollectionView.getContentDisclosureState(collectionView, parseInt(index, 0));
};

Selenium.prototype.getScCollectionViewContentOutlineLevel = function(path, index) {
  var collectionView = $ScPath.getPath(path, $SC.CollectionView);
  if (!collectionView) -1;
  return ScExt.CollectionView.getContentOutlineLevel(collectionView, parseInt(index, 0));
};

///////////////////// Selenium Core API Extensions - Locators ////////////////////////////////////

/**
  This locator is used access a SC view's root DOM element. ONLY use this locator for actions
  that expect a DOM element.
  
  A SC path follows the standard property dot-path notation, such as the following:
  
    MyApp.mainPage.mainPane.someButton
    
  For all paths supplied they must be relative to the root application object.
  
  To use this locator via the Selenium RC, the locator text must follow the given
  pattern:
  
    scPath=<your.sc.path.to.a.view.goes.here>
    
  As an example:
  
    clientDriver.click('scPath=mainPage.mainPane.someButton')
    
  If the root application object is called MyApp, then the view will be accessed 
  like so:
  
    view = MyApp.getPath('mainPage.mainPane.someButton)
  
*/
PageBot.prototype.locateElementByScPath = function(path) { 
  
  var obj = $ScPath.getPath(path, $SC.View);
  if (!obj) return null;

  // Return the view's layer. The layer is the root DOM element of the view
  return obj.get('layer');
  
};

/**
  This locator is used to access a DOM element the belongs to a core query object. ONLY use
  this locator for actions that expect a DOM element.
  
  To use this locator via the Selenium RC, the locator text must follow the given pattern:

    scCoreQuery=<core query handle>:<element index>
    
  where <core query handle> is the handle to the core query object and <element index> is
  the index to the element in the CQ object. As an example:
  
    clientDriver.click('scCoreQuery=2:1')
*/
PageBot.prototype.locateElementByScCoreQuery = function(text) {
  
  var args = text.split(':');
  var handle = args[0];
  var index = args[1];
  
  var cq = selenium._getCoreQueryObject(handle);
  var elem = cq.get(index);
  
  return elem;
  
};