export default {
  name: 'ButtonTag',
  props: {
    isChecked: {
      type: Boolean,
      required: true,
    },
    text: String,
    textChecked: String,
    textNotChecked: String,
  },
  emits: ['checked-toggle'],
  template: `
  <label class="button-tag">
    <input type="checkbox" :checked="isChecked" @change="(e)=>$emit('checked-toggle', e.currentTarget.checked)"/>
    <span v-if="text">{{text}}</span>
    <span v-if="textChecked" class="checked">{{textChecked}}</span>
    <span v-if="textNotChecked" class="not-checked">{{textNotChecked}}</span>
  </label>
  `
}