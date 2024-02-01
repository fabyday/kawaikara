import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from '@mui/material/Grid'
import { MenuPaper, Paper } from '@mui/material';
import Box from "@mui/material/Box"
import { useCurConfigureStore, usePrevConfigureStore } from './definition';
import { ChangeEvent, useState } from 'react';
type props = {
    id: string;
    values : string[]
    default_index : number;
    default_width_height_string : string
    onSelect_f : (id :string, value:string )=>void;
    onSelect_width_f? : (id :string, value:string )=>void;
    onSelect_height_f? :(id :string, value:string )=>void;
    make_appditional? : boolean
  };

const sep:string = "x"

function WindowSizeComponent({id, values, default_index, default_width_height_string, onSelect_f,onSelect_width_f, onSelect_height_f, make_appditional} : props){
    // 
    default_width_height_string = "1x100";
    
    let [w_str, h_str] = default_width_height_string.split("x")

    let flag = make_appditional === true ? true : false

    const [width, setWidth] = useState(Number(w_str));
    const [height, setHeight] = useState(Number(h_str));

    let [disable, set_disable] = useState(true)
    const handleChange = (e, setup_f) => {
        const regex = /^[0-9\b]+$/;
        if (e.target.value === "" || regex.test(e.target.value)) {
            setup_f(e.target.value);
        }
      };
    const builder =  ()=>{
        
        return ( <Grid container direction="column">
                <Grid item>
                    <FormControl >
                        <Select
                        labelId="demo-simple-select-label"
                        id={id}
                        value={values[default_index]}
                        style={{minWidth : "200px"}}
                        defaultValue={values[default_index]}

                        onChange={(e : SelectChangeEvent)=>{
                            if (e.target.value==="custom"){
                                set_disable(false)
                            }else{
                                onSelect_f(id, e.target.value)
                            }
                        }}>
                        {
                            values.map((v, i, a)=>(
                                <MenuItem value={v}>{v}</MenuItem>
                                ))
                                
                            }
                            <MenuItem value={"custom"}>Custom</MenuItem>
                        </Select>
                    </FormControl>
                    </Grid>
                    { flag &&
                        <Grid  item >
                        <TextField
                        
                        disabled ={disable}
                        label="width"
                        defaultValue="1920"
                        variant="filled" 
                        value = {width}
                        onBlur={(e)=>{
                            onSelect_width_f!(id, e.target.value)
                        }}

                        onChange={(e)=>{
                            handleChange(e, setWidth)
                            
                        }}
                        InputProps={{
                            style: { margin : 1, maxWidth: "100px" }
                        }}
                        />
                        <TextField
                        disabled = {disable}
                        id="filled-disabled"
                        label="height"
                        defaultValue="1080"
                        variant="filled"
                        onBlur={(e)=>{
                            onSelect_height_f!(id, e.target.value)
                        }}
                        onChange={(e)=>{handleChange(e, setHeight)}} 
                        value = {height}
                        InputProps={{
                            style: {margin:1, maxWidth: "100px" }
                        }}
                        />
                    </Grid>
                    }
                </Grid>)

}


return (  
    <Box display="flex" justifyContent="center">
        {builder()}
    </Box>

    )
}


export default WindowSizeComponent;