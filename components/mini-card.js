export default {
  name: 'MiniCard',
  props: {
    colored: String,
  },
  template:`
  <div class="mini-card">
   <div class="mini-card__head" :class="{'colored': colored?.includes('head')}">
     <slot name="head"></slot>
   </div>
   <div class="mini-card__body" :class="{'colored': colored?.includes('body')}">
     <slot name="body"></slot>
   </div>
  </div>
  `
}