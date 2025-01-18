import React, { useEffect } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import styled from '@emotion/styled';
import { config_states, shortcut_states } from './definition';

const FooterComponent = styled('div')({
    color: 'darkslategray',
    backgroundColor: '#002b45',
    width: '100%',
    position: 'fixed',
    padding : 5,
    bottom: 0,
    left: 0,
    zIndex: 100,
});

function Footer() {
    const is_changed = config_states(state=>state.is_changed)
    const [check_dups_all] = shortcut_states(state=>[state.check_duplication_all])


    const check_f=()=>{
        //TODO
        const c = is_changed() ;
        const b = check_dups_all();
        // console.log("c",c)
        // console.log("b",b)
        // return c&&b;
        return !c;
    }
    return (
        <FooterComponent>
            <Grid
                container
                justifyContent={'flex-end'}
                columnGap={1}
                columns={12}>
                <Grid xs={6} item>
                    <Box columnGap={1} display="flex" justifyContent="center">
                        <Button
                            variant="contained"
                            onClick={() => {
                                if(check_f()){
                                    console.log("ik")
                                }else{
                                    window.KAWAI_API.preference.close();
                                }
                            }}>
                            OK
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                window.KAWAI_API.preference.close();
                            }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {}}
                            disabled={check_f()}>
                            apply
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </FooterComponent>
    );
}

export default Footer;
