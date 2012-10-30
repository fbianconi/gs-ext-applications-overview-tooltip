const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;

const TOOLTIP_LABEL_SHOW_TIME = 0.15;
const TOOLTIP_LABEL_HIDE_TIME = 0.1;
const TOOLTIP_HOVER_TIMEOUT = 300;

// used to restore monkey patched function on disable
let _old_addItem = null;
// used to disconnect events on disable
let _tooltips = null;
// id of timer waiting for start
let _labelTimeoutId = 0;
// id of last (cancellable) timer
let _resetHoverTimeoutId = 0;
// actor for displaying the tooltip (or null)
let _label = null;
// self explainatory
let _labelShowing = false;

function init() {}



function enable() {
    _tooltips = new Array();
    // Enabling tooltips after _appIcons has been populated
    let appIcons = Main.overview._viewSelector._appsPage.get_child()
            .get_child()._delegate._view._appIcons;
    for (let i in appIcons) {
        _connect(appIcons[i].actor);
    }
    // monkeypatching for the load time and for the search overview tooltips
    _old_addItem = imports.ui.iconGrid.IconGrid.prototype.addItem;
    imports.ui.iconGrid.IconGrid.prototype.addItem = function(actor){
        _connect(actor);
        // original part of the function I'm overwriting (for real this time)
        _old_addItem.apply(this, arguments);
    };
}

function disable() {
    //restore the function
    imports.ui.iconGrid.IconGrid.prototype.addItem = _old_addItem;
    for (let i = 0; i < _tooltips.length; i++) {
        //disconnect hover signals
        _tooltips[i].actor.disconnect(_tooltips[i].connection);
    }
    _tooltips=null;
}

function _onHover(actor){
    if (actor.get_hover()) {
        if (_labelTimeoutId == 0) {
            let timeout = _labelShowing ? 0 : TOOLTIP_HOVER_TIMEOUT;
            _labelTimeoutId = Mainloop.timeout_add(timeout,
                function() {
                    _labelShowing = true;
                    _showTooltip(actor);
                    return false;
                }
            );
            if (_resetHoverTimeoutId > 0) {
                Mainloop.source_remove(_resetHoverTimeoutId);
                _resetHoverTimeoutId = 0;
            }
        }
    } else {
        if (_labelTimeoutId > 0){
            Mainloop.source_remove(_labelTimeoutId);
        }
        _labelTimeoutId = 0;
        _hideTooltip();
        if (_labelShowing) {
            _resetHoverTimeoutId = Mainloop.timeout_add(TOOLTIP_HOVER_TIMEOUT,
                function() {
                    _labelShowing = false;
                    return false;
                }
            );
        }
    }
}

function _showTooltip(actor) {
    let icontext = '';
    let should_display = false;
    if (actor._delegate.app){
        //applications overview
        icontext = actor._delegate.app.get_name();
        should_display = actor._delegate.icon.label.get_clutter_text().get_layout().is_ellipsized();
    }else if (actor._delegate._content._delegate){
        //app and settings searchs results
        icontext = actor._delegate.metaInfo['name'];
        should_display = actor._delegate._content._delegate.icon.label.get_clutter_text().get_layout().is_ellipsized();
    }else if (actor._delegate._content.label_actor){
        //locations and other (generic) search results (wanda wouldn't work)
        icontext = actor._delegate.metaInfo['name'];
        should_display = actor._delegate._content.label_actor.get_clutter_text().get_layout().is_ellipsized();
    }

    if (!should_display){
        return;
    }

    if (!_label) {
        _label = new St.Label({
            style_class: 'tooltip dash-label',
            text: icontext
        });
        Main.uiGroup.add_actor(_label);
    }else{
        _label.text = icontext;
    }

    [stageX, stageY] = actor.get_transformed_position();
    [iconWidth, iconHeight] = actor.get_transformed_size();

    let y = stageY + iconHeight + 5;
    let x = stageX - Math.round((_label.get_width() - iconWidth)/2);
    _label.opacity = 0;
    _label.set_position(x, y);
    Tweener.addTween(_label,{
        opacity: 255,
        time: TOOLTIP_LABEL_SHOW_TIME,
        transition: 'easeOutQuad',
    });
}

function _hideTooltip() {
    if (_label){
        Tweener.addTween(_label, {
            opacity: 0,
            time: TOOLTIP_LABEL_HIDE_TIME,
            transition: 'easeOutQuad',
            onComplete: function() {
                Main.uiGroup.remove_actor(_label);
                _label = null;
            }
        });
    }
}

function _connect(actr){
    let con = actr.connect('notify::hover', _onHover);
    _tooltips.push({actor: actr, connection: con});
}
