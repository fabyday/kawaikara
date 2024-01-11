const ffi = require("ffi-napi")
const ref = require('ref-napi')


const void_ptr = ref.refType(ref.types.void);
const string_ptr = ref.refType(ref.types.CString);

const Rect = Struct({
     left : "Long",
     top : "Long",
     right : "Long",
     bottom : "Long",
})
const RectPtr = ref.refType(Rect)

const DWMFLIP3DWINDOWPOLICY ={
    DWMFLIP3D_DEFAULT : 0,
    DWMFLIP3D_EXCLUDEBELOW : 1,
    DWMFLIP3D_EXCLUDEABOVE : 2,
    DWMFLIP3D_LAST : 3
  } ;

const DWMWINDOWATTRIBUTE = {
    DWMWA_NCRENDERING_ENABLED : {value : 0, input_size : ref.sizeof.int32 },
    DWMWA_NCRENDERING_POLICY : {value : 1, input_size : ref.sizeof.int32},
    DWMWA_TRANSITIONS_FORCEDISABLED : {value : 2, input_size : ref.sizeof.int32},
    DWMWA_ALLOW_NCPAINT : {value : 3, input_size : ref.sizeof.int32},
    DWMWA_CAPTION_BUTTON_BOUNDS : {value : 4, input_size : ref.sizeof.Object},
    DWMWA_NONCLIENT_RTL_LAYOUT : {value : 5, input_size :  ref.sizeof.int32},
    DWMWA_FORCE_ICONIC_REPRESENTATION : {value : 6, input_size :  ref.sizeof.int32},
    DWMWA_FLIP3D_POLICY : {value : 7, input_size :  ref.sizeof.Object},
    DWMWA_EXTENDED_FRAME_BOUNDS:{value : 8, input_size : ref.sizeof.Object},
    DWMWA_HAS_ICONIC_BITMAP:{value : 9, input_size : ref.sizeof.int32 },
    DWMWA_DISALLOW_PEEK : {value : 10, input_size : ref.sizeof.int32},
    DWMWA_EXCLUDED_FROM_PEEK : {value : 11, input_size : ref.sizeof.int32},
    DWMWA_CLOAK : {value : 12, input_size : ref.sizeof.Object},
    DWMWA_CLOAKED : {value : 13, input_size : ref.sizeof.Object},
    DWMWA_FREEZE_REPRESENTATION: {value : 14, input_size : ref.sizeof.Object},
    DWMWA_PASSIVE_UPDATE_MODE: {value : 15, input_size : ref.sizeof.int32},
    DWMWA_USE_HOSTBACKDROPBRUSH:  {value : 16, input_size : ref.sizeof.int32},
    DWMWA_USE_IMMERSIVE_DARK_MODE : {value : 20, input_size :ref.sizeof.int32 },
    DWMWA_WINDOW_CORNER_PREFERENCE : {value : 33, input_size : ref.sizeof.Object},
    DWMWA_BORDER_COLOR :{value : 34, input_size : ref.sizeof.Object},
    DWMWA_CAPTION_COLOR : {value : 35, input_size : ref.sizeof.Object},
    DWMWA_TEXT_COLOR : {value : 36, input_size : ref.sizeof.Object},
    DWMWA_VISIBLE_FRAME_BORDER_THICKNESS : {value : 37, input_size : ref.sizeof.Object},
    DWMWA_SYSTEMBACKDROP_TYPE : {value : 38, input_size : ref.sizeof.Object},
    DWMWA_LAST :{value : 39, input_size : ref.sizeof.Object},
  } ;



// function definition
const dwmapi = ffi.Library("Dwmapi.dll", {

    DwmSetWindowAttribute : ["long", ["long", "int32", void_ptr, "int32" ]]


})

S_OK = 0

const TRUE = 1;
const FALSE = 0;
const DwmSetWindowAttribute_wrapper = (hwnd, dwAttribute, data)=>{
    
    p_attrdata = ref.alloc(dwAttribute.input_size)
    ref.deref(p_attrdata) = data
    const ret = dwmapi.DwmSetWindowAttribute(hwnd,dwAttribute.value, p_attrdata, dwAttribute.input_size)

}

module.exports.dwmapi = dwmapi