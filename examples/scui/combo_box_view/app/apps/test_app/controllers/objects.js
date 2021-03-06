// ==========================================================================
// Project:   TestApp.objectsController
// ==========================================================================
/*globals TestApp */

/** @class

  (Document Your Controller Here)

  @extends SC.ArrayController
*/
TestApp.objectsController = SC.ArrayController.create({

	getAlphaObjects: function() {
		var objects = [];
		for(var i = 0; i < 26; i++) {
			var letter = { value: String.fromCharCode("A".charCodeAt(0) + i) };
			objects.push(letter);
		}
		return objects;
	},
	
	getFruitObjects: function() {
		return [ { name: 'apple', val:'apple' }, { name: 'pear', val:'pear' }, { name: 'strawberry', val:'strawberry' } ]; //, { name: 'peach' }, { name: 'blueberry' }, { name: 'plum' }, { name: 'banana' }, { name: 'orange' }, { name: 'grape' }, { name: 'raspberry' }, { name: 'watermelon' } ];
	}

}) ;
