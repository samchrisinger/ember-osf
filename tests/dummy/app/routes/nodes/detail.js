import Ember from 'ember';
import permissions from 'ember-osf/const/permissions';

export default Ember.Route.extend({
    model(params) {
        return this.store.findRecord('node', params.node_id);
    },

    setupController(controller, model) {
        controller.set('editedTitle', model.get('title'));
        controller.set('editedTitle', model.get('category'));
        controller.set('editedTitle', model.get('description'));
        this._super(...arguments);
    },

    actions: {
        editExisting(title, description, category, isPublic) {
            // TODO: Should test PUT or PATCH
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                if (title) {
                    node.set('title', title);
                }
                if (category) {
                    node.set('category', category);
                }
                if (description) {
                    node.set('description', description);
                }
                if (isPublic !== null) {
                    node.set('public', isPublic);
                }
                node.save();
            } else {
                console.log('You do not have permissions to edit this node');
            }
        },
        affiliateNode(instId) {
            this.store.findRecord('institution', instId).then(inst => {
                var node = this.modelFor(this.routeName);
                node.get('affiliatedInstitutions').pushObject(inst);
                node.save();
            });
        },
        deaffiliateNode(inst) {
            var node = this.modelFor(this.routeName);
            node.get('affiliatedInstitutions').removeObject(inst);
            node.save();
        },
        addContributor(contribId, permission, bibliographic) {
            var node = this.modelFor(this.routeName);
            if (contribId) {
                if (node.get('currentUserPermissions').indexOf(permissions.ADMIN) !== -1) {
                    var contributor = this.store.createRecord('contributor', {
                        userId: contribId,
                        permission: permission,
                        bibliographic: bibliographic,
                        nodeId: node.id
                    });
                    node.get('contributors').pushObject(contributor);
                    node.save();
                    console.log('Contributor added.');
                } else {
                    console.log('You do not have permissions to add contributors');
                }
            } else {
                console.log('User ID must be specified.');
            }
        },
        updateContributors(editedPermissions, editedBibliographic) {
            var node = this.modelFor(this.routeName);
            var contribMap = this.generateContributorMap(node.get('contributors'));
            let user = this.modelFor('application');

            for (var contrib in editedPermissions) {
                contribMap[contrib].permission = editedPermissions[contrib];
            }

            for (var c in editedBibliographic) {
                contribMap[c].bibliographic = editedBibliographic[c];
            }
            if (node.get('currentUserPermissions').indexOf(permissions.ADMIN) !== -1) {
                this.attemptContributorsUpdate(contribMap, node, editedPermissions, editedBibliographic);
            } else {
                // Non-admins can only attempt to remove themselves as contributors
                if (contrib.id === user.id) {
                    this.attemptContributorsUpdate(contribMap, node, editedPermissions,
                        editedBibliographic);
                } else {
                    console.log('Non-admins cannot update other contributors.');
                }
            }

        },
        deleteContributor(contrib) {
            var node = this.modelFor(this.routeName);
            contrib.setProperties({
                nodeId: node.id
            });
            let user = this.modelFor('application');

            var contribMap = this.generateContributorMap(node.get('contributors'));

            if (node.get('currentUserPermissions').indexOf(permissions.ADMIN) !== -1) {
                this.attemptContributorRemoval(contrib, contribMap);
            } else {
                // Non-admins can only attempt to remove themselves as contributors
                if (contrib.id === user.id) {
                    this.attemptContributorRemoval(contrib, contribMap);
                } else {
                    console.log('Non-admins cannot delete other contributors.');
                }
            }
        },
        addChild(title, description, category) {
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                var child = this.store.createRecord('node', {
                    title: title,
                    category: category || 'project',
                    description: description || null
                });
                node.get('children').pushObject(child);
                node.save();
                node.one('didUpdate', this, function() {
                    this.transitionTo('nodes.detail.children');
                });
            } else {
                console.log('You do not have permissions to create this component');
            }
        },
        addChildren(title1, title2) {
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                var child1 = this.store.createRecord('node', {
                    title: title1,
                    category: 'project'
                });
                var child2 = this.store.createRecord('node', {
                    title: title2,
                    category: 'project'
                });
                node.get('children').pushObject(child1);
                node.get('children').pushObject(child2);
                node.save();
            } else {
                console.log('You do not have permissions to create this component');
            }
        },
        deleteNode() {
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                node.one('didDelete', this, function() {
                    this.transitionTo('nodes.index');
                });
                node.destroyRecord();
            } else {
                console.log('You do not have permissions to delete this node');
            }
        },
        addNodeLink(targetNodeId) {
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                var nodeLink = this.store.createRecord('node-link', {
                    target: targetNodeId
                });
                node.get('nodeLinks').pushObject(nodeLink);
                node.save();
            } else {
                console.log('You do not have permissions to create a node link');
            }
        },
        removeNodeLink(targetNode) {
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf(permissions.WRITE) !== -1) {
                targetNode.destroyRecord();
                console.log('Node link removed.');
            } else {
                console.log('You do not have permissions to delete this node link.');
            }
        }
    },
    generateContributorMap(contributors) {
        // Maps all node contributors to format {contribID: {permission: "read|write|admin", bibliographic: "true|false"}}
        var contribMap = contributors.content.currentState.reduce(function(newMap, contrib) {
            newMap[contrib.id] = {
                permission: contrib._data.permission,
                bibliographic: contrib._data.bibliographic
            };
            return newMap;
        }, {});
        return contribMap;
    },
    canModifyContributor(contribRemoving, contribMap) {
        /** Checks to see if contributor(s) can be updated/removed. Contributor can only be updated/removed
        if there is at least one other contributor with admin permissions, and at least one other bibliographic contributor **/
        var bibliographic = false;
        var admin = false;
        for (var contribId in contribMap) {
            if (contribRemoving && contribId === contribRemoving.id) {
                continue;
            } else {
                if (contribMap[contribId].bibliographic) {
                    bibliographic = true;
                }
                if (contribMap[contribId].permission === 'admin') {
                    admin = true;
                }
            }
        }
        if (bibliographic && admin) {
            return true;
        }
        return false;
    },

    attemptContributorsUpdate(contribMap, node, editedPermissions, editedBibliographic) {
        if (this.canModifyContributor(null, contribMap)) {
            var promises = [];
            for (var contrib in editedPermissions) {
                promises.push(this.modifyPermissions(contrib, node, editedPermissions));
            }
            for (var c in editedBibliographic) {
                promises.push(this.modifyBibliographic(c, node, editedBibliographic));
            }
            Ember.RSVP.Promise.all(promises).then(() => node.save());
            console.log('Contributor(s) updated.');
        } else {
            console.log('Cannot update contributor(s)');
        }
    },

    modifyPermissions(contrib, node, editedPermissions) {
        return this.store.findRecord('contributor', contrib).then(function(contributor) {
            contributor.set('nodeId', node.id);
            contributor.set('permission', editedPermissions[contrib]);
        });
    },

    modifyBibliographic(contrib, node, editedBibliographic) {
        return this.store.findRecord('contributor', contrib).then(function(contributor) {
            contributor.set('nodeId', node.id);
            contributor.set('bibliographic', editedBibliographic[contrib]);
        });
    },

    attemptContributorRemoval(contrib, contribMap) {
        if (this.canModifyContributor(contrib, contribMap)) {
            contrib.deleteRecord();
            contrib.save();
            console.log('Contributor removed.');
        } else {
            console.log('Cannot remove contributor');
        }
    }
});
