export default {
  name: 'MiniCard',
  template:`
  <div class="mini-card">
   <div class="mini-card__title">
     <slot name="title"></slot>
   </div>
   <div class="mini-card__content">
     <slot name="content"></slot>
   </div>
  </div>
  `
}