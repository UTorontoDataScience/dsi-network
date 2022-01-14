import React, { useEffect, useMemo, useState } from 'react';
import {
    AppBar,
    Autocomplete,
    Box,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import debounce from 'lodash.debounce';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util/util';
import getModel, { ModelEntity } from '../../data/model';
import { ForceGraph, PackChart } from '../../Visualizations';
import { getEntityId } from '../../util';

const ChartPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] = useState<
        ModelEntity[] | null
    >();
    const [model, setModel] = useState<ModelEntity[]>();
    const [root, setRoot] = useState<ModelEntity>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
            setRoot(model.find(m => m.type === 'dsi'));
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
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {model && <PackChart entities={model} />}
                </Grid>
            )}
            {activeTab === 0 && (
                <Grid container direction="row" item>
                    <Grid item xs={9}>
                        {model && root && (
                            <ForceGraph
                                entities={model}
                                selectedModels={selected}
                                root={root}
                            />
                        )}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid container direction="column" item spacing={2}>
                            <Grid item>
                                <FormControl fullWidth>
                                    <InputLabel>Set Root</InputLabel>
                                    <Select
                                        onChange={e =>
                                            setRoot(
                                                (model || []).find(
                                                    m =>
                                                        e.target &&
                                                        getEntityId(m) ===
                                                            e.target.value
                                                )
                                            )
                                        }
                                        value={root ? getEntityId(root) : ''}
                                    >
                                        {(model || [])
                                            .filter(m =>
                                                ['campus', 'dsi'].includes(
                                                    m.type
                                                )
                                            )
                                            .map(m => (
                                                <MenuItem
                                                    key={m.name}
                                                    value={getEntityId(m)}
                                                >
                                                    {m.name}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    <Autocomplete
                                        clearOnEscape
                                        getOptionLabel={m => m.name}
                                        isOptionEqualToValue={(option, value) =>
                                            option.name === value.name
                                        }
                                        onChange={(event, value, reason) => {
                                            if (
                                                reason === 'selectOption' &&
                                                value
                                            ) {
                                                setDetailSelection(
                                                    model!.filter(
                                                        m =>
                                                            m.type ===
                                                                value.type &&
                                                            m.id === value.id
                                                    )
                                                );
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
                                                        .flatMap(
                                                            op =>
                                                                nameMap[op.name]
                                                        )
                                                ),
                                            500
                                        )}
                                        options={options}
                                        renderInput={params => (
                                            <TextField
                                                {...params}
                                                label="Search"
                                            />
                                        )}
                                    />
                                </FormControl>
                            </Grid>
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
