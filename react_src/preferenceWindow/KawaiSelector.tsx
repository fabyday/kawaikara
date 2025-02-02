import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid'
import { MenuPaper, Paper } from '@mui/material';
import Box from "@mui/material/Box"
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useEffect, useState } from 'react';

type onclick_prop = (a : boolean)=>void 
type props = {
    id: string;
    title : string
    preset_list : string[],
    value : string,
    select_f : (text : string)=>void;
    onselected_customize_f? : (index : number, width : number )=>void;
  };




function KawaiSelector({id, title, preset_list, value , select_f, onselected_customize_f} : props){

    const [val, set_args] = useState("");

useEffect(() => {
        let validValue = value
        validValue = preset_list.includes(value) ? value : preset_list[0];
        set_args(validValue)
        
    }, [value, preset_list]); 



return (  
    <Grid  container  spacing={12}  alignItems="center" justifyContent="center">
            <Grid item xs={6} justifyContent="center" width="100%"> <Typography  align="left" >{title}</Typography> </Grid>
            <Grid item xs={6}  justifyContent="center" alignItems="center">
                    <Box  display="flex" flexDirection="column" justifyContent="flex-start" alignItems="flex-start">
                    <FormControl>
                        <Select
                            labelId="sels"
                            id={id}
                            value={val}
                            style={{ minWidth: '200px' }}
                            onChange={(e: SelectChangeEvent) => {
                                select_f(e.target.value);
                            }}>
                            {preset_list.map((v, i, a) => {
                                return (
                                    <MenuItem
                                        key={`${id}.${i.toString()}`}
                                        id={`${id}.${i.toString()}`}
                                        value={v}>
                                        {v}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>
                    </Box>
                </Grid>
            </Grid>

    )
}


export default KawaiSelector;