import Ember from 'ember';
import permissions from 'ember-osf/const/permissions';

export default Ember.Route.extend({
    model() {
        let node = this.modelFor('nodes.detail');
        let drafts = node.get('draftRegistrations');
        return Ember.RSVP.hash({
            node: node,
            drafts: drafts
        });
    },
    actions: {
        createDraft(schemaId) {
            var node = this.modelFor(this.routeName).node;
            if (node.get('currentUserPermissions').indexOf(permissions.ADMIN) !== -1) {
                var draft = this.store.createRecord('draft-registration', {
                    registrationSupplement: schemaId
                });
                node.get('draftRegistrations').pushObject(draft);
                node.save();
                node.one('didUpdate', this, function() {
                    this.transitionTo('nodes.detail.draft_registrations.detail');
                });
            } else {
                console.log('You must have admin permission to create a draft.');
            }

        }
    }
});
