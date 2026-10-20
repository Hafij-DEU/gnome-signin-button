// Sign-In Button: puts a "go next" arrow in the auth prompt's default
// button well (where the spinner lives) so the password can be submitted
// with the mouse, not only with Enter. Works on the GDM greeter and on the
// lock screen, since both use gdm/authPrompt.js.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as AuthPrompt from 'resource:///org/gnome/shell/gdm/authPrompt.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const {AuthPromptStatus} = AuthPrompt;

function shouldShow(prompt) {
    const entry = prompt._entry;
    return !!entry &&
        entry.visible &&
        entry.reactive &&
        entry.text.length > 0 &&
        prompt.verificationStatus !== AuthPromptStatus.VERIFICATION_IN_PROGRESS;
}

function attach(prompt) {
    if (prompt._signInButton || !prompt._defaultButtonWell)
        return;

    const button = new St.Button({
        style_class: 'login-dialog-button cancel-button signin-button',
        accessible_name: 'Sign In',
        button_mask: St.ButtonMask.ONE,
        reactive: false,
        can_focus: false,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        icon_name: 'go-next-symbolic',
        opacity: 0,
    });
    prompt._defaultButtonWell.add_child(button);

    button.connect('clicked', () => {
        if (prompt._defaultButtonWellActor !== button || !shouldShow(prompt))
            return;
        // Reuse the entry's own activate handler (same path as Enter).
        prompt._entry.clutter_text.activate();
    });

    const update = () => {
        const show = shouldShow(prompt);
        const current = prompt._defaultButtonWellActor;

        button.reactive = show;
        button.can_focus = show;

        // Never fight the spinner while authentication is running.
        if (current === prompt._spinner)
            return;
        if (show && current !== button)
            prompt.setActorInDefaultButtonWell(button, true);
        else if (!show && current === button)
            prompt.setActorInDefaultButtonWell(null, true);
    };

    const connections = [];
    for (const entry of [prompt._textEntry, prompt._passwordEntry]) {
        if (!entry)
            continue;
        connections.push([entry.clutter_text, entry.clutter_text.connect('text-changed', update)]);
        connections.push([entry, entry.connect('notify::visible', update)]);
        connections.push([entry, entry.connect('notify::reactive', update)]);
    }

    prompt._signInButton = button;
    prompt._signInConnections = connections;
    update();
}

function detach(prompt) {
    const button = prompt._signInButton;
    if (!button)
        return;

    for (const [obj, id] of prompt._signInConnections ?? [])
        obj.disconnect(id);
    if (prompt._defaultButtonWellActor === button)
        prompt.setActorInDefaultButtonWell(null, false);
    button.destroy();

    delete prompt._signInButton;
    delete prompt._signInConnections;
}

export default class SignInButtonExtension extends Extension {
    enable() {
        const prompts = this._prompts = new Set();
        const track = prompt => {
            if (prompts.has(prompt))
                return;
            prompts.add(prompt);
            prompt.connect('destroy', () => prompts.delete(prompt));
            attach(prompt);
        };

        const proto = AuthPrompt.AuthPrompt.prototype;
        const original = this._originalInitInputRow = proto._initInputRow;
        proto._initInputRow = function (...args) {
            const ret = original.apply(this, args);
            try {
                track(this);
            } catch (e) {
                logError(e, 'signin-button');
            }
            return ret;
        };

        // A login/unlock dialog may already exist when we get enabled.
        const existing = Main.screenShield?._dialog?._authPrompt;
        if (existing)
            track(existing);
    }

    disable() {
        if (this._originalInitInputRow) {
            AuthPrompt.AuthPrompt.prototype._initInputRow = this._originalInitInputRow;
            this._originalInitInputRow = null;
        }
        for (const prompt of this._prompts ?? [])
            detach(prompt);
        this._prompts = null;
    }
}
