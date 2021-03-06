import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('tags-widget', 'Integration | Component | tags widget', {
  integration: true
});

test('it renders a tag', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });
  this.set('tags', ["hello"]);

  this.render(hbs`{{tags-widget tags=tags}}`);

  assert.equal(this.$('span').text().trim(), 'hello');
});
