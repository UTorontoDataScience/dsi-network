import React, { useEffect, useMemo, useState } from 'react';
import {
    AppBar,
    Autocomplete,
    Box,
    Grid,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import debounce from 'lodash.debounce';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util';
import getModel, { ModelEntity } from '../../data/model';
import { ForceGraph, PackChart } from '../../Visualizations';

const ChartPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] =
        useState<ModelEntity | null>();
    const [model, setModel] = useState<ModelEntity[]>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
        };
        _getModel();
    }, []);

    const options = useMemo(() => {
        if (model) {
            return model.filter(uniqueBy('name'));
        } else {
            return [];
        }
    }, [model]);

    const nameMap = useMemo(() => {
        if (model) {
            return groupBy(model, 'name');
        } else {
            return {};
        }
    }, [model]);

    return (
        <Grid container direction="column">
            <Grid item>
                <AppBar sx={{ margin: 3 }} position="static">
                    <Box padding={2}>
                        <Typography align="center" variant="h5">
                            DSI Network App
                        </Typography>
                    </Box>
                </AppBar>
            </Grid>
            <Grid item container justifyContent="center">
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label="Tree View" />
                    <Tab label="Nested View" />
                </Tabs>
            </Grid>
            {activeTab === 1 && (
                <Grid container justifyContent="center">
                    {/* <PackChart /> */}
                </Grid>
            )}
            {activeTab === 0 && (
                <Grid container direction="row" item>
                    <Grid item xs={9}>
                        {model && (
                            <ForceGraph
                                entities={model}
                                selectedModels={selected}
                            />
                        )}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid item>
                            <Autocomplete
                                clearOnEscape
                                getOptionLabel={m => m.name}
                                isOptionEqualToValue={(option, value) =>
                                    option.name === value.name
                                }
                                onChange={(event, value, reason) => {
                                    if (reason === 'selectOption' && value) {
                                        setDetailSelection(value);
                                    }
                                    if (reason === 'clear') {
                                        setDetailSelection(null);
                                    }
                                }}
                                onInputChange={debounce(
                                    (event, value) =>
                                        setSelected(
                                            options
                                                .filter(
                                                    option =>
                                                        !!value &&
                                                        option.name
                                                            .toLowerCase()
                                                            .includes(
                                                                value.toLowerCase()
                                                            )
                                                )
                                                .flatMap(op => nameMap[op.name])
                                                .map(op => ({
                                                    id: op.id,
                                                    type: op.type,
                                                }))
                                        ),
                                    500
                                )}
                                options={options}
                                renderInput={params => (
                                    <TextField {...params} label="Search" />
                                )}
                            />
                        </Grid>
                        <Grid item>
                            {!!detailSelection && (
                                <DetailCard item={detailSelection} />
                            )}
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Grid>
    );
};

export default ChartPage;
