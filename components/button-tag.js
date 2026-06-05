export default {
  name: 'ButtonTag',
  props: {
    isChecked: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['checked-toggle'],
  template: `
  <label class="button-tag">
    <input type="checkbox" :checked="isChecked" @change="(e)=>$emit('checked-toggle', e.currentTarget.checked)"/>
    <span v-if="$slots.default"><slot></slot></span>
    <span v-if="$slots.checked" class="checked"><slot name="checked"></slot></span>
    <span v-if="$slots['not-checked']" class="not-checked"><slot name="not-checked"></slot></span>
  </label>
  `
}