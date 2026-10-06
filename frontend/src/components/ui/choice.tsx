import { createContext, createUniqueId, useContext, type JSX, type ParentComponent } from 'solid-js';
import { haptic } from '@/lib/feedback';

const GroupName = createContext<string>();

/**
 * A labelled group of choices, rendered as a native <fieldset>. Radios inside share one `name`, so the
 * browser gives arrow-key navigation and one tab stop for free.
 */
export const ChoiceGroup: ParentComponent<{ label: string; class?: string }> = (props) => {
  const name = createUniqueId();
  return (
    <GroupName.Provider value={name}>
      <fieldset class={`min-w-0 ${props.class ?? ''}`}>
        <legend class="sr-only">{props.label}</legend>
        {props.children}
      </fieldset>
    </GroupName.Provider>
  );
};

/**
 * One choice: a native radio/checkbox, visually hidden, inside a label you can style like anything
 * (chip, swatch, row). The label gets `data-checked` when selected, for `data-checked:` utilities.
 */
export const Choice: ParentComponent<{
  checked: boolean;
  onChange: () => void;
  type?: 'radio' | 'checkbox';
  class?: string;
  style?: JSX.CSSProperties;
  /** Accessible name when the visible content isn't descriptive (e.g. a colour swatch). */
  label?: string;
  ref?: (el: HTMLLabelElement) => void;
  /** Skip the haptic tap when the caller gives its own feedback. */
  quiet?: boolean;
}> = (props) => {
  const name = useContext(GroupName);
  return (
    <label ref={props.ref} class={props.class} style={props.style} data-checked={props.checked ? '' : undefined}>
      <input
        type={props.type ?? 'radio'}
        name={props.type === 'checkbox' ? undefined : name}
        class="sr-only"
        checked={props.checked}
        aria-label={props.label}
        onChange={() => {
          if (!props.quiet) haptic();
          props.onChange();
        }}
      />
      {props.children}
    </label>
  );
};
