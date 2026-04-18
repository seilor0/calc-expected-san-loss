import ButtonCssIcon from "./components/button-css-icon.js";
import ButtonTag from "./components/button-tag.js";
import ToggleButton from "./components/toggle-button.js";
import { clamp, floatRound, applyAdjustment } from "../__utility/function.js";

const {createApp, ref, computed, watch, onMounted, toRaw} = Vue;

const rootApp = createApp({
  components: {
    ButtonCssIcon,
    ButtonTag,
    ToggleButton,
  },

  setup () {
    const setting = ref({
      process: 'calc-evalue',
      unitName: '',
      options: {
        autoSuccess: true,
        preRoll: true,
        altRoll: true,
        actLoss: true,
      }
    });

    const initInsanity = ref(0);

    const unitDataMap = ref(new Map());
    const unitData = computed(() => unitDataMap.value.get(setting.value.unitName) ?? {skill:new Map([])});
    watch(unitData, ()=>{
      if ('san' in unitData.value) initInsanity.value = unitData.value.san;
    });

    class SancData {
      sancText = '';
      isPlus = false;

      // option 1
      autoSuccess = '';
      // option 2
      preRoll = {
        skill: '',
        adjustment: '',
        isSucceed: false,
      };
      // option 3
      altRoll = {
        skill: '',
        adjustment: '',
      };
      // option 4
      actLoss = '';

      constructor (sancText, isPlus) {
        this.sancText = sancText;
        this.isPlus = isPlus;
      }
      
      get sancExDic () {
        const splitArr = this.sancText.split('/');
        if (splitArr.length===1)
          return {single: true, ex: calcEx(this.sancText)};
        else if (splitArr.length===2)
          return {single: false, sucEx: calcEx(splitArr[0]), failEx: calcEx(splitArr[1])};
        else {
          console.log('out of sancText-text-format.');
          return null;
        }
        function calcEx(diceText) {
          let ex = 0;
          diceText
            .split('+')
            .forEach(str => {
              if (/^\d+$/.test(str)) ex += parseInt(str);
              else if (/^\d+D\d+$/i.test(str)) {
                const {num, dice} = str.match(/^(?<num>\d+)D(?<dice>\d+)$/i)?.groups ?? {};
                ex += parseInt(num) * (1+parseInt(dice)) / 2;
              }
            });
          return ex;
        }
      }
    }
    
    const sancDataArr = ref([]);
    const sanDataArr = computed(() => {
      const resultArr = [];
      let remain = initInsanity.value;

      sancDataArr.value.forEach((sancData, i) => {
        if (!sancData.sancExDic) return;

        // option 2 : 発生率
        let preRollRate = null;
        if (setting.value.options.preRoll && sancData.preRoll.skill!=='') {
          const adjustment = sancData.preRoll.adjustment;
          preRollRate = sancData.preRoll.skill==='else' ? 
            (parseInt(adjustment) || 0) : 
            applyAdjustment(unitData.value.skill.get(sancData.preRoll.skill), adjustment);
          preRollRate = clamp(preRollRate, 0, 100);
        }

        // option 3 : 判定値
        let altRollRate = null;
        if (setting.value.options.altRoll && sancData.altRoll.skill !== '') {
          const adjustment = sancData.altRoll.adjustment;
          altRollRate = sancData.altRoll.skill==='else' ?
            (parseInt(adjustment) || 0) : 
            applyAdjustment(unitData.value.skill.get(sancData.altRoll.skill), adjustment);
          altRollRate = clamp(altRollRate, 0, 100);
        }

        let lossEx;
        if (sancData.sancExDic.single)
          lossEx = sancData.sancExDic.ex;

        // option 1
        else if (sancData.autoSuccess !== '')
          lossEx = sancData.autoSuccess==='success' ? sancData.sancExDic.sucEx : sancData.sancExDic.failEx;

        else {
          // option 3
          const rate = clamp(altRollRate ?? remain, 0, 100) / 100;
          lossEx = sancData.sancExDic.sucEx * rate + sancData.sancExDic.failEx * (1-rate);
          // option 2
          if (preRollRate!==null) lossEx *= preRollRate/100;
        }

        // option 4
        const loss = setting.value.options.actLoss && Number.isInteger(sancData.actLoss) ? 
          sancData.actLoss : lossEx;
        remain += (sancData.isPlus ? 1 : -1) * loss;

        resultArr.push({lossEx:lossEx, remainSan:remain, preRoll:preRollRate, altRoll:altRollRate});
      });
      console.log('san-data-arr:', resultArr);
      return resultArr;
    });

    const allSanLoss = computed(() => {
      return sanDataArr.value.at(-1) ? initInsanity.value - sanDataArr.value.at(-1).remainSan : 0;
    });

    function addNewData () {sancDataArr.value.push(new SancData('',false));}
    function deleteLastData() {sancDataArr.value.pop();}



    onMounted(async () => {
      const json = await fetch('./setting.json').then(res=>res.json());
      setting.value = json.setting;
      document.querySelector('footer table tbody').innerHTML = json.changeLog
      .reduce((acc, cur) => acc += `<tr><td>${cur.date}</td><td>${cur.version}</td><td>${cur.detail}</td></tr>`, '');
    })



    return {
      setting,
      initInsanity,
      allSanLoss,
      unitDataMap,
      unitData,
      sancDataArr,
      sanDataArr,
      addNewData,
      deleteLastData,
      floatRound,
    }
  }
});
rootApp.mount('#root');